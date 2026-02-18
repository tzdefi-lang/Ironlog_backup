import XCTest
@testable import IronLog

final class StatsServiceTests: XCTestCase {
    func testLoadInsightThresholds() {
        let insight = StatsService.loadInsight(weeklyVolumes: [4000, 4200, 4100, 4300, 7000])
        XCTAssertEqual(insight.level, .high)
    }

    func testWeeklyVolumeAggregation() {
        let workouts = [
            Workout(
                id: "w1",
                date: DateUtils.formatDate(),
                title: "A",
                note: "",
                exercises: [ExerciseInstance(id: "e1", defId: "d1", sets: [WorkoutSet(id: "s1", weight: 100, reps: 5, completed: true)])],
                completed: true,
                elapsedSeconds: 0,
                startTimestamp: nil
            ),
        ]

        let weekly = StatsService.weeklyVolumes(workouts: workouts)
        XCTAssertFalse(weekly.isEmpty)
        XCTAssertTrue(weekly.contains(where: { $0.volume >= 500 }))
    }

    func testWeeklyWorkoutCountsIncludesCompletedOnly() {
        let workouts = [
            Workout(id: "a", date: "2026-02-16", title: "A", note: "", exercises: [], completed: true, elapsedSeconds: 100, startTimestamp: nil),
            Workout(id: "b", date: "2026-02-17", title: "B", note: "", exercises: [], completed: false, elapsedSeconds: 100, startTimestamp: nil),
            Workout(id: "c", date: "2026-02-18", title: "C", note: "", exercises: [], completed: true, elapsedSeconds: 200, startTimestamp: nil),
        ]

        let counts = StatsService.weeklyWorkoutCounts(
            workouts: workouts,
            weeks: 1,
            from: StatsService.parseLocalDate("2026-02-18") ?? Date()
        )

        XCTAssertEqual(counts.count, 1)
        XCTAssertEqual(counts[0].count, 2)
    }

    func testWorkoutDurationsFiltersAndLimits() {
        let workouts = [
            Workout(id: "a", date: "2026-02-10", title: "A", note: "", exercises: [], completed: true, elapsedSeconds: 3600, startTimestamp: nil),
            Workout(id: "b", date: "2026-02-11", title: "B", note: "", exercises: [], completed: true, elapsedSeconds: 0, startTimestamp: nil),
            Workout(id: "c", date: "2026-02-12", title: "C", note: "", exercises: [], completed: false, elapsedSeconds: 2400, startTimestamp: nil),
            Workout(id: "d", date: "2026-02-13", title: "D", note: "", exercises: [], completed: true, elapsedSeconds: 1800, startTimestamp: nil),
        ]

        let durations = StatsService.workoutDurations(workouts: workouts, limit: 10)
        XCTAssertEqual(durations.count, 2)
        XCTAssertEqual(durations.first?.minutes, 60)
        XCTAssertEqual(durations.last?.minutes, 30)
    }

    func testLoadTrendPointsMarksCurrentAndBaseline() {
        let baseDate = StatsService.parseLocalDate("2026-01-05") ?? Date()
        let vols: [(weekStart: Date, volume: Double)] = (0 ..< 8).compactMap { idx in
            guard let date = Calendar.current.date(byAdding: .day, value: idx * 7, to: baseDate) else { return nil }
            return (weekStart: date, volume: Double(1000 + idx * 100))
        }

        let points = StatsService.loadTrendPoints(weeklyVolumes: vols)
        XCTAssertEqual(points.count, 8)
        XCTAssertTrue(points.last?.isCurrent == true)
        XCTAssertEqual(points[0].baseline, 0)
        XCTAssertGreaterThan(points[4].baseline, 0)
    }
}
