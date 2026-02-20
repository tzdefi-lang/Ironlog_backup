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
        let normalizedExercises = data.exercises
            .sorted {
                if $0.sortOrder == $1.sortOrder {
                    return $0.id < $1.id
                }
                return $0.sortOrder < $1.sortOrder
            }
            .enumerated()
            .map { index, exercise in
                var updated = exercise
                updated.sortOrder = index
                return updated
            }

        return Workout(
            id: id,
            date: date,
            title: title,
            note: data.note,
            exercises: normalizedExercises,
            completed: completed,
            elapsedSeconds: data.elapsedSeconds,
            startTimestamp: data.startTimestamp
        )
    }

    static func from(_ workout: Workout, userId: String) -> WorkoutRow {
        let normalizedExercises = workout.exercises.enumerated().map { index, exercise in
            var updated = exercise
            updated.sortOrder = index
            return updated
        }

        return WorkoutRow(
            id: workout.id,
            user_id: userId,
            date: workout.date,
            title: workout.title,
            completed: workout.completed,
            data: WorkoutDataJSON(
                exercises: normalizedExercises,
                note: workout.note,
                elapsedSeconds: workout.elapsedSeconds,
                startTimestamp: workout.startTimestamp
            )
        )
    }
}
