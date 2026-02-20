import Foundation

final class ExerciseDefRepository {
    private let provider: SupabaseClientProvider

    init(provider: SupabaseClientProvider = .shared) {
        self.provider = provider
    }

    func fetchPersonal(limit: Int = 200, offset: Int = 0) async throws -> [ExerciseDef] {
        let safeLimit = max(1, limit)
        let safeOffset = max(0, offset)
        let rows: [ExerciseDefRow] = try await provider.client.database
            .from("exercise_defs")
            .select()
            .order("name", ascending: true)
            .range(from: safeOffset, to: safeOffset + safeLimit - 1)
            .execute()
            .value
        AppLogger.repository.debug("Fetched personal exercise defs count=\(rows.count, privacy: .public) offset=\(safeOffset, privacy: .public) limit=\(safeLimit, privacy: .public)")
        return rows.map { $0.toDomain(source: .personal) }
    }

    func fetchOfficial(limit: Int = 200, offset: Int = 0) async throws -> [ExerciseDef] {
        let safeLimit = max(1, limit)
        let safeOffset = max(0, offset)
        let rows: [ExerciseDefRow] = try await provider.client.database
            .from("official_exercise_defs")
            .select()
            .order("updated_at", ascending: false)
            .range(from: safeOffset, to: safeOffset + safeLimit - 1)
            .execute()
            .value
        AppLogger.repository.debug("Fetched official exercise defs count=\(rows.count, privacy: .public) offset=\(safeOffset, privacy: .public) limit=\(safeLimit, privacy: .public)")
        return rows.map { $0.toDomain(source: .official) }
    }

    func upsert(_ def: ExerciseDef, userId: String) async throws {
        let row = ExerciseDefRow.from(def, userId: userId)
        try await provider.client.database
            .from("exercise_defs")
            .upsert(row)
            .execute()
    }

    func delete(id: String) async throws {
        try await provider.client.database
            .from("exercise_defs")
            .delete()
            .eq("id", value: id)
            .execute()
    }
}
