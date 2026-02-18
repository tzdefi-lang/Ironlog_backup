import Foundation
import SwiftData

@Model
final class WorkoutModel {
    @Attribute(.unique) var id: String
    var date: String
    var title: String
    var note: String
    var completed: Bool
    var elapsedSeconds: Double
    var startTimestamp: Double?
    @Relationship(deleteRule: .cascade) var exercises: [ExerciseInstanceModel]
    var lastModified: Date

    init(
        id: String,
        date: String,
        title: String,
        note: String,
        completed: Bool,
        elapsedSeconds: Double,
        startTimestamp: Double?,
        exercises: [ExerciseInstanceModel] = [],
        lastModified: Date = Date()
    ) {
        self.id = id
        self.date = date
        self.title = title
        self.note = note
        self.completed = completed
        self.elapsedSeconds = elapsedSeconds
        self.startTimestamp = startTimestamp
        self.exercises = exercises
        self.lastModified = lastModified
    }
}
