import Foundation

struct WorkoutTemplateRow: Codable, Sendable {
    var id: String
    var user_id: String?
    var name: String
    var description: String
    var tagline: String
    var data: DataJSON
    var created_at: String

    struct DataJSON: Codable, Sendable {
        var exercises: [WorkoutTemplateExercise]
        var description: String?
        var tagline: String?
    }

    func toDomain(source: ContentSource) -> WorkoutTemplate {
        WorkoutTemplate(
            id: id,
            name: name,
            source: source,
            readOnly: source == .official,
            description: description,
            tagline: tagline,
            exercises: data.exercises,
            createdAt: created_at
        )
    }

    static func from(_ template: WorkoutTemplate, userId: String) -> WorkoutTemplateRow {
        WorkoutTemplateRow(
            id: template.id,
            user_id: userId,
            name: template.name,
            description: template.description,
            tagline: template.tagline,
            data: DataJSON(
                exercises: template.exercises,
                description: template.description,
                tagline: template.tagline
            ),
            created_at: template.createdAt
        )
    }
}
