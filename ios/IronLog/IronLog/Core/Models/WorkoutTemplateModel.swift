import Foundation
import SwiftData

@Model
final class WorkoutTemplateModel {
    @Attribute(.unique) var id: String
    var name: String
    var source: String
    var readOnly: Bool
    var descriptionText: String?
    var tagline: String?
    var exercisesJSON: Data?
    var createdAt: String

    init(
        id: String,
        name: String,
        source: String,
        readOnly: Bool,
        descriptionText: String? = nil,
        tagline: String? = nil,
        exercisesJSON: Data? = nil,
        createdAt: String
    ) {
        self.id = id
        self.name = name
        self.source = source
        self.readOnly = readOnly
        self.descriptionText = descriptionText
        self.tagline = tagline
        self.exercisesJSON = exercisesJSON
        self.createdAt = createdAt
    }
}
