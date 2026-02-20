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

    func testFormatDisplayDateUsesReadableEnglishFormat() {
        let formatted = DateUtils.formatDisplayDate("2026-02-20", locale: Locale(identifier: "en_US"))
        XCTAssertEqual(formatted, "Feb 20, 2026")
    }

    func testFormatDisplayDateFallsBackForInvalidInput() {
        let locale = Locale(identifier: "en_US")
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.setLocalizedDateFormatFromTemplate("MMM d, yyyy")

        let expected = formatter.string(from: Date())
        let actual = DateUtils.formatDisplayDate("not-a-date", locale: locale)

        XCTAssertEqual(actual, expected)
    }

    func testFormatDisplayDateSupportsNonEnglishLocale() {
        let formatted = DateUtils.formatDisplayDate("2026-02-20", locale: Locale(identifier: "zh_Hans"))
        XCTAssertTrue(formatted.contains("2026"))
        XCTAssertFalse(formatted.isEmpty)
    }
}
