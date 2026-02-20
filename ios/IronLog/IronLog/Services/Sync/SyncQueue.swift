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
        let item = SyncQueueItemModel(
            id: UUID().uuidString,
            userId: userId,
            table: table,
            action: action,
            payloadJSON: payload,
            timestamp: Date().timeIntervalSince1970 * 1000,
            idempotencyKey: idempotencyKey
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
