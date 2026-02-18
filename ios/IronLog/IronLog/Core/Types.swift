import Foundation

enum Unit: String, Codable, CaseIterable, Sendable {
    case kg
    case lbs
}

enum ThemeMode: String, Codable, CaseIterable, Sendable {
    case light
    case dark
    case system
}

enum ContentSource: String, Codable, Sendable {
    case personal
    case official
}

enum ExerciseMediaKind: String, Codable, Sendable {
    case upload
    case youtube
}

enum ExerciseMediaContentType: String, Codable, Sendable {
    case image
    case video
}

struct ExerciseMediaItem: Identifiable, Codable, Hashable, Sendable {
    var id: String
    var kind: ExerciseMediaKind
    var contentType: ExerciseMediaContentType
    var url: String
    var title: String?
}

struct WorkoutSet: Identifiable, Codable, Hashable, Sendable {
    var id: String
    var weight: Double
    var reps: Int
    var completed: Bool
}

struct ExerciseInstance: Identifiable, Codable, Hashable, Sendable {
    var id: String
    var defId: String
    var sets: [WorkoutSet]
}

struct Workout: Identifiable, Codable, Hashable, Sendable {
    var id: String
    var date: String
    var title: String
    var note: String
    var exercises: [ExerciseInstance]
    var completed: Bool
    var elapsedSeconds: Double
    var startTimestamp: Double?
}

struct WorkoutTemplateExercise: Codable, Hashable, Sendable {
    var defId: String
    var defaultSets: Int
}

struct WorkoutTemplate: Identifiable, Codable, Hashable, Sendable {
    var id: String
    var name: String
    var source: ContentSource
    var readOnly: Bool
    var description: String
    var tagline: String
    var exercises: [WorkoutTemplateExercise]
    var createdAt: String
}

struct ExerciseDef: Identifiable, Codable, Hashable, Sendable {
    var id: String
    var name: String
    var description: String
    var source: ContentSource
    var readOnly: Bool
    var thumbnailUrl: String?
    var markdown: String
    var mediaItems: [ExerciseMediaItem]
    var mediaUrl: String?
    var mediaType: ExerciseMediaContentType?
    var category: String
    var usesBarbell: Bool
    var barbellWeight: Double
}

struct UserPreferences: Codable, Hashable, Sendable {
    var defaultUnit: Unit
    var restTimerSeconds: Int
    var themeMode: ThemeMode
    var notificationsEnabled: Bool

    static let `default` = UserPreferences(
        defaultUnit: .lbs,
        restTimerSeconds: 90,
        themeMode: .system,
        notificationsEnabled: false
    )
}

struct UserProfile: Codable, Hashable, Sendable {
    var id: String
    var privyDid: String?
    var name: String
    var email: String
    var photoUrl: String?
    var walletAddress: String?
    var solanaAddress: String?
    var loginMethod: String?
    var preferences: UserPreferences
}

struct LoadGuardrails: Sendable {
    let minBaselineVolume: Double
    let minAbsoluteIncrease: Double
    let elevatedRatio: Double
    let highRatio: Double
    let lowRatio: Double

    static let webParity = LoadGuardrails(
        minBaselineVolume: 3000,
        minAbsoluteIncrease: 1200,
        elevatedRatio: 1.28,
        highRatio: 1.45,
        lowRatio: 0.72
    )
}
