import Foundation

final class OfficialContentRepository {
    private let exerciseRepo: ExerciseDefRepository
    private let templateRepo: TemplateRepository

    init(exerciseRepo: ExerciseDefRepository = ExerciseDefRepository(), templateRepo: TemplateRepository = TemplateRepository()) {
        self.exerciseRepo = exerciseRepo
        self.templateRepo = templateRepo
    }

    func fetch() async throws -> (exerciseDefs: [ExerciseDef], templates: [WorkoutTemplate]) {
        async let defs = exerciseRepo.fetchOfficial()
        async let templates = templateRepo.fetchOfficial()
        return try await (defs, templates)
    }
}
