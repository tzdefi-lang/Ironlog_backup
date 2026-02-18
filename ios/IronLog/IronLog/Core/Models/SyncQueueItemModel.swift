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

    init(id: String, userId: String, table: String, action: String, payloadJSON: Data, timestamp: Double) {
        self.id = id
        self.userId = userId
        self.table = table
        self.action = action
        self.payloadJSON = payloadJSON
        self.timestamp = timestamp
    }
}
