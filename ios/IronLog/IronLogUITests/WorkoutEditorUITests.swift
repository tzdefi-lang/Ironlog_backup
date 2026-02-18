import XCTest

final class WorkoutEditorUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testAppLaunchesForWorkoutFlow() throws {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.exists)
    }
}
