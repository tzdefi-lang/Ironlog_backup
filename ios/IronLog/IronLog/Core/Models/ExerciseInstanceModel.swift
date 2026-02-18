import Foundation
import SwiftData

@Model
final class ExerciseInstanceModel {
    @Attribute(.unique) var id: String
    var defId: String
    @Relationship(deleteRule: .cascade) var sets: [WorkoutSetModel]

    init(id: String, defId: String, sets: [WorkoutSetModel] = []) {
        self.id = id
        self.defId = defId
        self.sets = sets
    }
}
