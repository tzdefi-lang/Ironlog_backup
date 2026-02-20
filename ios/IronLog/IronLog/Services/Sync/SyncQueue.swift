import Foundation
import SwiftData

struct QueuedOperation: Codable, Sendable {
    let id: String
    let userId: String
    let table: String
    let action: String
    let payload: Data
    let timestamp: Double
    let idempotencyKey: String
    let retryCount: Int
    let lastError: String?
    let nextRetryAt: Double?

    init(
        id: String,
        userId: String,
        table: String,
        action: String,
        payload: Data,
        timestamp: Double,
        idempotencyKey: String = UUID().uuidString,
        retryCount: Int = 0,
        lastError: String? = nil,
        nextRetryAt: Double? = nil
    ) {
        self.id = id
        self.userId = userId
        self.table = table
        self.action = action
        self.payload = payload
        self.timestamp = timestamp
        self.idempotencyKey = idempotencyKey
        self.retryCount = retryCount
        self.lastError = lastError
        self.nextRetryAt = nextRetryAt
    }
}

enum SyncQueueDisposition: Equatable {
    case retry
    case drop
    case halt
}

struct SyncOperationResponse: Codable, Sendable {
    let applied: Bool
    let deduped: Bool
}

enum SyncOperationServiceError: LocalizedError {
    case unauthenticated
    case invalidPayload
    case invalidResponse
    case serverError(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .unauthenticated:
            return "Sign in required before syncing queued data."
        case .invalidPayload:
            return "Invalid queued payload."
        case .invalidResponse:
            return "Invalid sync-operation response."
        case .serverError(_, let message):
            return message
        }
    }

    var statusCode: Int? {
        switch self {
        case .serverError(let status, _):
            return status
        default:
            return nil
        }
    }

    var isRetryable: Bool {
        guard let statusCode else { return false }
        return statusCode == 429 || (500 ... 599).contains(statusCode)
    }

    var isAuth: Bool {
        guard let statusCode else { return false }
        return statusCode == 401 || statusCode == 403
    }
}

final class SyncOperationService {
    private let provider: SupabaseClientProvider

    init(provider: SupabaseClientProvider = .shared) {
        self.provider = provider
    }

    func execute(item: SyncQueueItemModel) async throws -> SyncOperationResponse {
        guard let token = provider.currentAuthToken else {
            throw SyncOperationServiceError.unauthenticated
        }

        let payloadObject = try parsePayload(item.payloadJSON)
        let requestBody: [String: Any] = [
            "idempotencyKey": item.idempotencyKey,
            "table": item.table,
            "action": item.action,
            "payload": payloadObject,
        ]

        var request = URLRequest(url: Constants.supabaseURL.appending(path: "/functions/v1/sync-operation"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(Constants.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw SyncOperationServiceError.invalidResponse
        }

        guard 200 ..< 300 ~= http.statusCode else {
            let message = parseErrorMessage(from: data) ?? "sync-operation request failed."
            throw SyncOperationServiceError.serverError(status: http.statusCode, message: message)
        }

        do {
            return try JSONDecoder().decode(SyncOperationResponse.self, from: data)
        } catch {
            throw SyncOperationServiceError.invalidResponse
        }
    }

    private func parsePayload(_ data: Data) throws -> [String: Any] {
        let object = try JSONSerialization.jsonObject(with: data)
        guard let dictionary = object as? [String: Any] else {
            throw SyncOperationServiceError.invalidPayload
        }
        return dictionary
    }

    private func parseErrorMessage(from data: Data) -> String? {
        do {
            let object = try JSONSerialization.jsonObject(with: data)
            guard let dictionary = object as? [String: Any],
                  let message = dictionary["error"] as? String else {
                return nil
            }
            let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        } catch {
            return nil
        }
    }
}

enum SyncErrorClassifier {
    static func disposition(for error: Error) -> SyncQueueDisposition {
        if isPayloadError(error) {
            return .drop
        }
        if isRetryableError(error) {
            return .retry
        }
        if isAuthError(error) {
            return .halt
        }
        return .halt
    }

    static func isRetryableError(_ error: Error) -> Bool {
        if let syncOperationError = error as? SyncOperationServiceError {
            return syncOperationError.isRetryable
        }

        if error is URLError {
            return true
        }

        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain {
            return true
        }

        if (500 ... 599).contains(nsError.code) {
            return true
        }

        let message = "\(error) \(nsError.localizedDescription)".lowercased()
        if message.contains("offline") || message.contains("timed out") || message.contains("connection") {
            return true
        }
        return contains5xxStatusCode(in: message)
    }

    static func isPayloadError(_ error: Error) -> Bool {
        if let syncOperationError = error as? SyncOperationServiceError,
           case .invalidPayload = syncOperationError {
            return true
        }

        if error is DecodingError || error is EncodingError {
            return true
        }

        let nsError = error as NSError
        if nsError.domain == NSCocoaErrorDomain {
            switch nsError.code {
            case CocoaError.coderInvalidValue.rawValue,
                 CocoaError.coderReadCorrupt.rawValue,
                 CocoaError.coderValueNotFound.rawValue:
                return true
            default:
                break
            }
        }

        let message = "\(error) \(nsError.localizedDescription)".lowercased()
        return message.contains("invalid payload") || message.contains("decod")
    }

    static func isAuthError(_ error: Error) -> Bool {
        if let syncOperationError = error as? SyncOperationServiceError {
            return syncOperationError.isAuth
        }

        let nsError = error as NSError
        if nsError.code == 401 || nsError.code == 403 {
            return true
        }
        let message = "\(error) \(nsError.localizedDescription)".lowercased()
        return message.contains("unauthorized") || message.contains("forbidden")
    }

    private static func contains5xxStatusCode(in text: String) -> Bool {
        let numbers = text.split { !$0.isNumber }
        return numbers.contains(where: { token in
            token.count == 3 && token.first == "5"
        })
    }
}

@MainActor
final class SyncQueue {
    private let modelContext: ModelContext

    init(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    func enqueue(
        userId: String,
        table: String,
        action: String,
        payload: Data,
        idempotencyKey: String = UUID().uuidString
    ) async throws {
        let trimmedKey = idempotencyKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let effectiveIdempotencyKey = trimmedKey.isEmpty ? UUID().uuidString : trimmedKey

        let item = SyncQueueItemModel(
            id: UUID().uuidString,
            userId: userId,
            table: table,
            action: action,
            payloadJSON: payload,
            timestamp: Date().timeIntervalSince1970 * 1000,
            idempotencyKey: effectiveIdempotencyKey
        )
        modelContext.insert(item)
        try modelContext.save()
    }

    func list(userId: String) throws -> [SyncQueueItemModel] {
        let descriptor = FetchDescriptor<SyncQueueItemModel>(
            predicate: #Predicate { $0.userId == userId },
            sortBy: [SortDescriptor(\.timestamp)]
        )
        return try modelContext.fetch(descriptor)
    }

    func flush(userId: String, executor: @escaping (SyncQueueItemModel) async throws -> Void) async {
        do {
            let items = try list(userId: userId)
            let now = Date().timeIntervalSince1970 * 1000
            for item in items {
                if let nextRetryAt = item.nextRetryAt, nextRetryAt > now {
                    continue
                }

                do {
                    try await executor(item)
                    modelContext.delete(item)
                    try modelContext.save()
                } catch {
                    switch SyncErrorClassifier.disposition(for: error) {
                    case .retry:
                        item.retryCount += 1
                        item.lastError = (error as NSError).localizedDescription
                        item.nextRetryAt = Date().timeIntervalSince1970 * 1000 + retryDelay(for: item.retryCount) * 1000
                        try modelContext.save()
                        AppLogger.sync.warning("Queue item retry scheduled. table=\(item.table, privacy: .public) action=\(item.action, privacy: .public) retry=\(item.retryCount, privacy: .public)")
                        return
                    case .drop:
                        AppLogger.sync.error("Dropping non-retryable queue item. table=\(item.table, privacy: .public) action=\(item.action, privacy: .public) error=\((error as NSError).localizedDescription, privacy: .public)")
                        modelContext.delete(item)
                        try modelContext.save()
                    case .halt:
                        item.lastError = (error as NSError).localizedDescription
                        try modelContext.save()
                        AppLogger.sync.error("Halting queue flush. table=\(item.table, privacy: .public) action=\(item.action, privacy: .public) error=\((error as NSError).localizedDescription, privacy: .public)")
                        return
                    }
                }
            }
        } catch {
            AppLogger.sync.error("Failed to flush queue: \((error as NSError).localizedDescription, privacy: .public)")
        }
    }

    private func retryDelay(for retryCount: Int) -> Double {
        let cappedRetry = min(max(retryCount, 1), 6)
        return pow(2, Double(cappedRetry - 1))
    }
}
