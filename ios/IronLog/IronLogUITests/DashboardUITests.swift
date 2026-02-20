import XCTest

final class DashboardUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testDashboardLaunches() throws {
        let app = XCUIApplication()
        app.launch()

        let loginTitle = app.staticTexts["IronLog"]
        let dashboardTitle = app.staticTexts["Workout"]

        let deadline = Date().addingTimeInterval(12)
        var matched = false

        while Date() < deadline {
            if loginTitle.exists || dashboardTitle.exists {
                matched = true
                break
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        }

        XCTAssertTrue(matched, "Expected login or dashboard content to appear")
    }
}
