import XCTest
@testable import IronLog

@MainActor
final class WorkoutEditorViewModelTests: XCTestCase {
    func testCurrentTimeUsesMillisecondStartTimestamp() {
        let startMs = Date().timeIntervalSince1970 * 1000 - 5_000
        let workout = Workout(
            id: "w1",
            date: "2026-02-20",
            title: "Test",
            note: "",
            exercises: [],
            completed: false,
            elapsedSeconds: 10,
            startTimestamp: startMs
        )

        let viewModel = WorkoutEditorViewModel(workout: workout)
        XCTAssertEqual(viewModel.currentTime, 15, accuracy: 0.8)
    }
}
