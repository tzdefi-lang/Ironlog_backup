import Foundation

struct WorkoutRow: Codable, Sendable {
    var id: String
    var user_id: String
    var date: String
    var title: String
    var completed: Bool
    var data: WorkoutDataJSON

    struct WorkoutDataJSON: Codable, Sendable {
        var exercises: [ExerciseInstance]
        var note: String
        var elapsedSeconds: Double
        var startTimestamp: Double?
    }

    func toDomain() -> Workout {
        Workout(
            id: id,
            date: date,
            title: title,
            note: data.note,
            exercises: data.exercises,
            completed: completed,
            elapsedSeconds: data.elapsedSeconds,
            startTimestamp: data.startTimestamp
        )
    }

    static func from(_ workout: Workout, userId: String) -> WorkoutRow {
        WorkoutRow(
            id: workout.id,
            user_id: userId,
            date: workout.date,
            title: workout.title,
            completed: workout.completed,
            data: WorkoutDataJSON(
                exercises: workout.exercises,
                note: workout.note,
                elapsedSeconds: workout.elapsedSeconds,
                startTimestamp: workout.startTimestamp
            )
        )
    }
}
