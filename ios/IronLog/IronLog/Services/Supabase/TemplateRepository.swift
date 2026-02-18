import Foundation

final class TemplateRepository {
    private let provider: SupabaseClientProvider

    init(provider: SupabaseClientProvider = .shared) {
        self.provider = provider
    }

    func fetchPersonal() async throws -> [WorkoutTemplate] {
        let rows: [WorkoutTemplateRow] = try await provider.client.database
            .from("workout_templates")
            .select()
            .order("created_at", ascending: false)
            .execute()
            .value
        return rows.map { $0.toDomain(source: .personal) }
    }

    func fetchOfficial() async throws -> [WorkoutTemplate] {
        let rows: [WorkoutTemplateRow] = try await provider.client.database
            .from("official_workout_templates")
            .select()
            .order("created_at", ascending: false)
            .execute()
            .value
        return rows.map { $0.toDomain(source: .official) }
    }

    func upsert(_ template: WorkoutTemplate, userId: String) async throws {
        let row = WorkoutTemplateRow.from(template, userId: userId)
        try await provider.client.database
            .from("workout_templates")
            .upsert(row)
            .execute()
    }

    func delete(id: String) async throws {
        try await provider.client.database
            .from("workout_templates")
            .delete()
            .eq("id", value: id)
            .execute()
    }
}
