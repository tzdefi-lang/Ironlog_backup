import Foundation

final class TemplateRepository {
    private let provider: SupabaseClientProvider

    init(provider: SupabaseClientProvider = .shared) {
        self.provider = provider
    }

    func fetchPersonal(limit: Int = 200, offset: Int = 0) async throws -> [WorkoutTemplate] {
        let safeLimit = max(1, limit)
        let safeOffset = max(0, offset)
        let rows: [WorkoutTemplateRow] = try await provider.client.database
            .from("workout_templates")
            .select()
            .order("created_at", ascending: false)
            .range(from: safeOffset, to: safeOffset + safeLimit - 1)
            .execute()
            .value
        AppLogger.repository.debug("Fetched personal templates count=\(rows.count, privacy: .public) offset=\(safeOffset, privacy: .public) limit=\(safeLimit, privacy: .public)")
        return rows.map { $0.toDomain(source: .personal) }
    }

    func fetchOfficial(limit: Int = 200, offset: Int = 0) async throws -> [WorkoutTemplate] {
        let safeLimit = max(1, limit)
        let safeOffset = max(0, offset)
        let rows: [WorkoutTemplateRow] = try await provider.client.database
            .from("official_workout_templates")
            .select()
            .order("created_at", ascending: false)
            .range(from: safeOffset, to: safeOffset + safeLimit - 1)
            .execute()
            .value
        AppLogger.repository.debug("Fetched official templates count=\(rows.count, privacy: .public) offset=\(safeOffset, privacy: .public) limit=\(safeLimit, privacy: .public)")
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
