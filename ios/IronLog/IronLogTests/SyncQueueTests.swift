import XCTest
@testable import IronLog

final class SyncQueueTests: XCTestCase {
    func testQueuedOperationCodableRoundTrip() throws {
        let payload = try JSONSerialization.data(withJSONObject: ["id": "workout-1", "title": "Push"])
        let operation = QueuedOperation(
            id: "op-1",
            userId: "user-1",
            table: "workouts",
            action: "upsert",
            payload: payload,
            timestamp: 1_234_567
        )

        let encoded = try JSONEncoder().encode(operation)
        let decoded = try JSONDecoder().decode(QueuedOperation.self, from: encoded)

        XCTAssertEqual(decoded.id, operation.id)
        XCTAssertEqual(decoded.userId, operation.userId)
        XCTAssertEqual(decoded.table, operation.table)
        XCTAssertEqual(decoded.action, operation.action)
        XCTAssertEqual(decoded.timestamp, operation.timestamp)
    }

    func testFIFOOrderByTimestamp() {
        let operations = [
            QueuedOperation(id: "op-3", userId: "u", table: "workouts", action: "upsert", payload: Data(), timestamp: 300),
            QueuedOperation(id: "op-1", userId: "u", table: "workouts", action: "upsert", payload: Data(), timestamp: 100),
            QueuedOperation(id: "op-2", userId: "u", table: "workouts", action: "delete", payload: Data(), timestamp: 200),
        ]

        let ordered = operations.sorted { $0.timestamp < $1.timestamp }
        XCTAssertEqual(ordered.map(\.id), ["op-1", "op-2", "op-3"])
    }

    func testSyncErrorClassifierRetriesNetworkErrors() {
        let error = URLError(.timedOut)
        XCTAssertEqual(SyncErrorClassifier.disposition(for: error), .retry)
    }

    func testSyncErrorClassifierDropsPayloadErrors() {
        let error = DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "invalid payload"))
        XCTAssertEqual(SyncErrorClassifier.disposition(for: error), .drop)
    }

    func testSyncErrorClassifierHaltsUnauthorizedErrors() {
        let error = NSError(domain: "HTTP", code: 401, userInfo: [NSLocalizedDescriptionKey: "Unauthorized"])
        XCTAssertEqual(SyncErrorClassifier.disposition(for: error), .halt)
    }

    func testSyncErrorClassifierRetriesSyncOperationServerErrors() {
        let error = SyncOperationServiceError.serverError(status: 503, message: "Service unavailable")
        XCTAssertEqual(SyncErrorClassifier.disposition(for: error), .retry)
    }
}
