import Foundation
import SwiftData

struct QueuedOperation: Codable, Sendable {
    let id: String
    let userId: String
    let table: String
    let action: String
    let payload: Data
    let timestamp: Double
}

@MainActor
final class SyncQueue {
    private let modelContext: ModelContext

    init(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    func enqueue(userId: String, table: String, action: String, payload: Data) async throws {
        let item = SyncQueueItemModel(
            id: UUID().uuidString,
            userId: userId,
            table: table,
            action: action,
            payloadJSON: payload,
            timestamp: Date().timeIntervalSince1970 * 1000
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
            for item in items {
                do {
                    try await executor(item)
                    modelContext.delete(item)
                    try modelContext.save()
                } catch {
                    break
                }
            }
        } catch {
            // Keep queue for next attempt.
        }
    }
}
