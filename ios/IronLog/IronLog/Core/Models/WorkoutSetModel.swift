import Foundation
import SwiftData

@Model
final class WorkoutSetModel {
    @Attribute(.unique) var id: String
    var weight: Double
    var reps: Int
    var completed: Bool

    init(id: String, weight: Double, reps: Int, completed: Bool) {
        self.id = id
        self.weight = weight
        self.reps = reps
        self.completed = completed
    }
}
