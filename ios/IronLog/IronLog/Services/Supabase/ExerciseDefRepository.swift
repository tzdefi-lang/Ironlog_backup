import Foundation

final class ExerciseDefRepository {
    private let provider: SupabaseClientProvider

    init(provider: SupabaseClientProvider = .shared) {
        self.provider = provider
    }

    func fetchPersonal() async throws -> [ExerciseDef] {
        let rows: [ExerciseDefRow] = try await provider.client.database
            .from("exercise_defs")
            .select()
            .execute()
            .value
        return rows.map { $0.toDomain(source: .personal) }
    }

    func fetchOfficial() async throws -> [ExerciseDef] {
        let rows: [ExerciseDefRow] = try await provider.client.database
            .from("official_exercise_defs")
            .select()
            .order("updated_at", ascending: false)
            .execute()
            .value
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
