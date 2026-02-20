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
        // Temporarily strip media/markdown from official exercises to avoid
        // freeze caused by eager media loading. Re-enable once official
        // content is re-populated with verified media URLs.
        let isOfficial = source == .official
        let firstUpload = isOfficial ? nil : data.mediaItems?.first(where: { $0.kind == .upload })
        return ExerciseDef(
            id: id,
            name: name,
            description: isOfficial ? "" : description,
            source: source,
            readOnly: isOfficial,
            thumbnailUrl: isOfficial ? nil : (thumbnail_url ?? data.thumbnailUrl),
            markdown: isOfficial ? "" : (data.markdown ?? ""),
            mediaItems: isOfficial ? [] : (data.mediaItems ?? []),
            mediaUrl: isOfficial ? nil : (firstUpload?.url ?? media_url),
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
