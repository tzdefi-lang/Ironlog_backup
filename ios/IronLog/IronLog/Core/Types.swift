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
    var rpe: Double?
    var note: String?
    var preSetRestSeconds: Int?

    init(
        id: String,
        weight: Double,
        reps: Int,
        completed: Bool,
        rpe: Double? = nil,
        note: String? = nil,
        preSetRestSeconds: Int? = nil
    ) {
        self.id = id
        self.weight = weight
        self.reps = reps
        self.completed = completed
        self.rpe = rpe
        self.note = note
        self.preSetRestSeconds = preSetRestSeconds
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case weight
        case reps
        case completed
        case rpe
        case note
        case preSetRestSeconds
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        weight = try container.decode(Double.self, forKey: .weight)
        reps = try container.decode(Int.self, forKey: .reps)
        completed = try container.decode(Bool.self, forKey: .completed)
        rpe = try container.decodeIfPresent(Double.self, forKey: .rpe)
        note = try container.decodeIfPresent(String.self, forKey: .note)
        preSetRestSeconds = try container.decodeIfPresent(Int.self, forKey: .preSetRestSeconds)
    }
}

struct ExerciseInstance: Identifiable, Codable, Hashable, Sendable {
    var id: String
    var defId: String
    var sets: [WorkoutSet]
    var sortOrder: Int

    init(id: String, defId: String, sets: [WorkoutSet], sortOrder: Int = 0) {
        self.id = id
        self.defId = defId
        self.sets = sets
        self.sortOrder = sortOrder
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case defId
        case sets
        case sortOrder
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        defId = try container.decode(String.self, forKey: .defId)
        sets = try container.decode([WorkoutSet].self, forKey: .sets)
        sortOrder = try container.decodeIfPresent(Int.self, forKey: .sortOrder) ?? 0
    }
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
    var loginMethod: String?
    var preferences: UserPreferences
    var createdAt: String?
    var lastLoginAt: String?
    var subscriptionTier: String?
    var subscriptionStatus: String?

    init(
        id: String,
        privyDid: String? = nil,
        name: String,
        email: String,
        photoUrl: String? = nil,
        loginMethod: String? = nil,
        preferences: UserPreferences,
        createdAt: String? = nil,
        lastLoginAt: String? = nil,
        subscriptionTier: String? = nil,
        subscriptionStatus: String? = nil
    ) {
        self.id = id
        self.privyDid = privyDid
        self.name = name
        self.email = email
        self.photoUrl = photoUrl
        self.loginMethod = loginMethod
        self.preferences = preferences
        self.createdAt = createdAt
        self.lastLoginAt = lastLoginAt
        self.subscriptionTier = subscriptionTier
        self.subscriptionStatus = subscriptionStatus
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case privyDid
        case name
        case email
        case photoUrl
        case loginMethod
        case preferences
        case createdAt
        case lastLoginAt
        case subscriptionTier
        case subscriptionStatus
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        privyDid = try container.decodeIfPresent(String.self, forKey: .privyDid)
        name = try container.decode(String.self, forKey: .name)
        email = try container.decode(String.self, forKey: .email)
        photoUrl = try container.decodeIfPresent(String.self, forKey: .photoUrl)
        loginMethod = try container.decodeIfPresent(String.self, forKey: .loginMethod)
        preferences = try container.decodeIfPresent(UserPreferences.self, forKey: .preferences) ?? .default
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        lastLoginAt = try container.decodeIfPresent(String.self, forKey: .lastLoginAt)
        subscriptionTier = try container.decodeIfPresent(String.self, forKey: .subscriptionTier)
        subscriptionStatus = try container.decodeIfPresent(String.self, forKey: .subscriptionStatus)
    }
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
