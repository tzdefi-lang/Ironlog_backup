import Foundation
import SwiftData

@Model
final class SyncQueueItemModel {
    @Attribute(.unique) var id: String
    var userId: String
    var table: String
    var action: String
    var payloadJSON: Data
    var timestamp: Double
    var idempotencyKey: String
    var retryCount: Int
    var lastError: String?
    var nextRetryAt: Double?

    init(
        id: String,
        userId: String,
        table: String,
        action: String,
        payloadJSON: Data,
        timestamp: Double,
        idempotencyKey: String,
        retryCount: Int = 0,
        lastError: String? = nil,
        nextRetryAt: Double? = nil
    ) {
        self.id = id
        self.userId = userId
        self.table = table
        self.action = action
        self.payloadJSON = payloadJSON
        self.timestamp = timestamp
        self.idempotencyKey = idempotencyKey
        self.retryCount = retryCount
        self.lastError = lastError
        self.nextRetryAt = nextRetryAt
    }
}
