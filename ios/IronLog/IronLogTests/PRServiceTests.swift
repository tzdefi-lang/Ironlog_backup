import XCTest
@testable import IronLog

final class PRServiceTests: XCTestCase {
    func testCalculatePRsAndBrokenPRs() {
        let pastWorkout = Workout(
            id: "w1",
            date: "2026-02-10",
            title: "Past",
            note: "",
            exercises: [
                ExerciseInstance(id: "e1", defId: "bench", sets: [
                    WorkoutSet(id: "s1", weight: 80, reps: 5, completed: true)
                ])
            ],
            completed: true,
            elapsedSeconds: 0,
            startTimestamp: nil
        )

        let current = Workout(
            id: "w2",
            date: "2026-02-11",
            title: "Current",
            note: "",
            exercises: [
                ExerciseInstance(id: "e2", defId: "bench", sets: [
                    WorkoutSet(id: "s2", weight: 90, reps: 3, completed: true)
                ])
            ],
            completed: false,
            elapsedSeconds: 0,
            startTimestamp: nil
        )

        let historical = PRService.calculatePRs(workouts: [pastWorkout])
        let defs = [
            ExerciseDef(
                id: "bench",
                name: "Bench Press",
                description: "",
                source: .personal,
                readOnly: false,
                thumbnailUrl: nil,
                markdown: "",
                mediaItems: [],
                mediaUrl: nil,
                mediaType: nil,
                category: "Chest",
                usesBarbell: true,
                barbellWeight: 20
            )
        ]

        let breaks = PRService.calculateBrokenPRs(workout: current, historical: historical, exerciseDefs: defs)
        XCTAssertFalse(breaks.isEmpty)
        XCTAssertTrue(breaks.contains(where: { $0.metric == .maxWeight }))
    }
}
