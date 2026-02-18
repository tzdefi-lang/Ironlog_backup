import Foundation
import SwiftData

@Model
final class ExerciseDefModel {
    @Attribute(.unique) var id: String
    var name: String
    var descriptionText: String
    var source: String
    var readOnly: Bool
    var category: String
    var usesBarbell: Bool
    var barbellWeight: Double
    var mediaItemsJSON: Data?
    var markdown: String?
    var thumbnailUrl: String?
    var lastModified: Date

    init(
        id: String,
        name: String,
        descriptionText: String,
        source: String,
        readOnly: Bool,
        category: String,
        usesBarbell: Bool,
        barbellWeight: Double,
        mediaItemsJSON: Data? = nil,
        markdown: String? = nil,
        thumbnailUrl: String? = nil,
        lastModified: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.descriptionText = descriptionText
        self.source = source
        self.readOnly = readOnly
        self.category = category
        self.usesBarbell = usesBarbell
        self.barbellWeight = barbellWeight
        self.mediaItemsJSON = mediaItemsJSON
        self.markdown = markdown
        self.thumbnailUrl = thumbnailUrl
        self.lastModified = lastModified
    }
}
