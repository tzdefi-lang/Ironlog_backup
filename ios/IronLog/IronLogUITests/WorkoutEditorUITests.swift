import XCTest

final class WorkoutEditorUITests: XCTestCase {
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

    private func openWorkoutFromDashboard(_ app: XCUIApplication) {
        let openButton = app.buttons["dashboard.openWorkoutButton"].firstMatch
        XCTAssertTrue(openButton.waitForExistence(timeout: 6))
        openButton.tap()
        _ = waitForWorkoutEditor(app)
    }

    private func openExerciseDetailFromWorkout(_ app: XCUIApplication) {
        let detailButton = app.buttons["exerciseCard.showDetailButton"].firstMatch
        XCTAssertTrue(detailButton.waitForExistence(timeout: 4))
        detailButton.tap()
        XCTAssertTrue(app.staticTexts["Description"].firstMatch.waitForExistence(timeout: 6))
    }

    func testAppLaunchesForWorkoutFlow() throws {
        let app = launchApp()

        XCTAssertTrue(app.exists)
    }

    func testPlusAndDashboardOpenPresentWorkoutEditorFullScreen() {
        let app = launchApp()

        let newWorkoutButton = app.buttons["tabbar.newWorkoutButton"]
        XCTAssertTrue(newWorkoutButton.waitForExistence(timeout: 6))
        newWorkoutButton.tap()

        XCTAssertTrue(app.buttons["Add Exercise"].firstMatch.waitForExistence(timeout: 6))

        let closeButton = waitForWorkoutEditor(app)
        closeButton.tap()

        let dismissDeadline = Date().addingTimeInterval(2)
        while Date() < dismissDeadline, closeButton.exists {
            RunLoop.current.run(until: Date().addingTimeInterval(0.1))
        }
        XCTAssertFalse(closeButton.exists)

        openWorkoutFromDashboard(app)
    }

    func testAddSetIncreasesRowsAndExerciseNameOpensDetail() {
        let app = launchApp()
        openWorkoutFromDashboard(app)

        let setRows = app.descendants(matching: .any).matching(identifier: "exerciseCard.setRow")
        let initialCount = setRows.count

        let addSetButton = app.buttons["exerciseCard.addSetButton"].firstMatch
        XCTAssertTrue(addSetButton.waitForExistence(timeout: 3))
        addSetButton.tap()

        let deadline = Date().addingTimeInterval(3)
        var increased = false
        while Date() < deadline {
            if setRows.count > initialCount {
                increased = true
                break
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.1))
        }
        XCTAssertTrue(increased, "Expected set row count to increase after tapping Add Set")

        openExerciseDetailFromWorkout(app)
    }

    func testExerciseDetailShowsEnhancedSectionsAndExpandableHistory() {
        let app = launchApp()
        openWorkoutFromDashboard(app)
        openExerciseDetailFromWorkout(app)

        XCTAssertTrue(app.staticTexts["Description"].firstMatch.waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Current Session"].firstMatch.waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Performance"].firstMatch.waitForExistence(timeout: 3))

        let historyRowButton = app.buttons["exerciseDetail.historyRow.w-last"].firstMatch
        XCTAssertTrue(historyRowButton.waitForExistence(timeout: 4))
        historyRowButton.tap()
        XCTAssertTrue(app.staticTexts["95 × 5"].firstMatch.waitForExistence(timeout: 3))
    }

    func testExercisePickerDetailDoesNotShowCurrentSession() {
        let app = launchApp()

        let newWorkoutButton = app.buttons["tabbar.newWorkoutButton"]
        XCTAssertTrue(newWorkoutButton.waitForExistence(timeout: 6))
        newWorkoutButton.tap()

        let addExerciseButton = app.buttons["Add Exercise"]
        XCTAssertTrue(addExerciseButton.waitForExistence(timeout: 4))
        addExerciseButton.tap()

        let infoButton = app.buttons["Exercise info"].firstMatch
        XCTAssertTrue(infoButton.waitForExistence(timeout: 6))
        infoButton.tap()

        XCTAssertTrue(app.staticTexts["Description"].firstMatch.waitForExistence(timeout: 6))
        XCTAssertFalse(app.staticTexts["Current Session"].exists)
    }
}
