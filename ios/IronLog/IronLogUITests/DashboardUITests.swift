import XCTest

final class DashboardUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @discardableResult
    private func launchApp() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += ["UITEST_MODE", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        return app
    }

    @discardableResult
    private func waitForWorkoutEditor(_ app: XCUIApplication, timeout: TimeInterval = 8) -> XCUIElement {
        let closeByIdentifier = app.buttons["workoutEditor.closeButton"].firstMatch
        if closeByIdentifier.waitForExistence(timeout: timeout) {
            return closeByIdentifier
        }

        let closeByLabel = app.buttons["Close workout editor"].firstMatch
        XCTAssertTrue(closeByLabel.waitForExistence(timeout: 2))
        return closeByLabel
    }

    private func openHistory(_ app: XCUIApplication) {
        let profileTab = app.buttons["Profile"]
        XCTAssertTrue(profileTab.waitForExistence(timeout: 6))
        profileTab.tap()

        let historyRow = app.buttons["profile.historyRow"]
        XCTAssertTrue(historyRow.waitForExistence(timeout: 6))
        historyRow.tap()
    }

    func testDashboardLaunches() throws {
        let app = launchApp()

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

    func testHistoryCardTapOpensWorkoutEditor() {
        let app = launchApp()
        openHistory(app)

        let workoutCard = app.buttons["history.workoutCard.w-today"].firstMatch
        XCTAssertTrue(workoutCard.waitForExistence(timeout: 6))
        workoutCard.tap()

        _ = waitForWorkoutEditor(app)
    }

    func testHistoryCardSwipeDelete() {
        let app = launchApp()
        openHistory(app)

        let workoutCard = app.buttons["history.workoutCard.w-today"].firstMatch
        XCTAssertTrue(workoutCard.waitForExistence(timeout: 6))
        XCTAssertFalse(workoutCard.label.localizedCaseInsensitiveContains("open"))
        XCTAssertFalse(workoutCard.label.localizedCaseInsensitiveContains("copy"))

        let start = workoutCard.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5))
        let shortEnd = workoutCard.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.5))
        start.press(forDuration: 0.01, thenDragTo: shortEnd)
        XCTAssertTrue(workoutCard.exists)

        let fullEnd = workoutCard.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.5))
        start.press(forDuration: 0.01, thenDragTo: fullEnd)

        let disappearDeadline = Date().addingTimeInterval(4)
        while Date() < disappearDeadline, workoutCard.exists {
            RunLoop.current.run(until: Date().addingTimeInterval(0.1))
        }
        XCTAssertFalse(workoutCard.exists)

        let toast = app.staticTexts["Workout deleted"]
        XCTAssertTrue(toast.waitForExistence(timeout: 3))
    }
}
