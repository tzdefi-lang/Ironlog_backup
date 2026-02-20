import Foundation

final class OfficialContentRepository {
    typealias Snapshot = (exerciseDefs: [ExerciseDef], templates: [WorkoutTemplate])

    private let exerciseRepo: ExerciseDefRepository
    private let templateRepo: TemplateRepository
    private let ttlSeconds: TimeInterval
    private var cache: (snapshot: Snapshot, expiresAt: Date)?

    init(
        exerciseRepo: ExerciseDefRepository = ExerciseDefRepository(),
        templateRepo: TemplateRepository = TemplateRepository(),
        ttlSeconds: TimeInterval = 3600
    ) {
        self.exerciseRepo = exerciseRepo
        self.templateRepo = templateRepo
        self.ttlSeconds = ttlSeconds
    }

    func fetch(forceRefresh: Bool = false) async throws -> Snapshot {
        let now = Date()
        if !forceRefresh, let cache, cache.expiresAt > now {
            AppLogger.repository.debug("Official content cache hit. expiresAt=\(cache.expiresAt.timeIntervalSince1970, privacy: .public)")
            return cache.snapshot
        }

        AppLogger.repository.debug("Official content cache miss. forceRefresh=\(forceRefresh, privacy: .public)")
        async let defs = exerciseRepo.fetchOfficial()
        async let templates = templateRepo.fetchOfficial()
        let snapshot = try await (defs, templates)
        cache = (snapshot, now.addingTimeInterval(ttlSeconds))
        return snapshot
    }

    func clearCache() {
        cache = nil
    }
}
