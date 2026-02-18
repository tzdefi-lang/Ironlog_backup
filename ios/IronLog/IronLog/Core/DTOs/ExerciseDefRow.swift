import Foundation

struct ExerciseDefRow: Codable, Sendable {
    var id: String
    var user_id: String?
    var name: String
    var description: String
    var media_url: String?
    var media_type: String?
    var thumbnail_url: String?
    var data: DataJSON

    struct DataJSON: Codable, Sendable {
        var category: String?
        var usesBarbell: Bool?
        var barbellWeight: Double?
        var thumbnailUrl: String?
        var markdown: String?
        var mediaItems: [ExerciseMediaItem]?
    }

    func toDomain(source: ContentSource) -> ExerciseDef {
        let firstUpload = data.mediaItems?.first(where: { $0.kind == .upload })
        return ExerciseDef(
            id: id,
            name: name,
            description: description,
            source: source,
            readOnly: source == .official,
            thumbnailUrl: thumbnail_url ?? data.thumbnailUrl,
            markdown: data.markdown ?? "",
            mediaItems: data.mediaItems ?? [],
            mediaUrl: firstUpload?.url ?? media_url,
            mediaType: {
                if let raw = firstUpload?.contentType.rawValue ?? media_type {
                    return ExerciseMediaContentType(rawValue: raw)
                }
                return nil
            }(),
            category: data.category ?? "Other",
            usesBarbell: data.usesBarbell ?? false,
            barbellWeight: data.barbellWeight ?? 0
        )
    }

    static func from(_ def: ExerciseDef, userId: String) -> ExerciseDefRow {
        let firstUpload = def.mediaItems.first(where: { $0.kind == .upload })
        return ExerciseDefRow(
            id: def.id,
            user_id: userId,
            name: def.name,
            description: def.description,
            media_url: firstUpload?.url ?? def.mediaUrl,
            media_type: firstUpload?.contentType.rawValue ?? def.mediaType?.rawValue,
            thumbnail_url: def.thumbnailUrl,
            data: DataJSON(
                category: def.category,
                usesBarbell: def.usesBarbell,
                barbellWeight: def.barbellWeight,
                thumbnailUrl: def.thumbnailUrl,
                markdown: def.markdown,
                mediaItems: def.mediaItems
            )
        )
    }
}
