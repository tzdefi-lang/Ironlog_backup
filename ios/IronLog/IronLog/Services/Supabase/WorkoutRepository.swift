import Foundation

final class WorkoutRepository {
    private let provider: SupabaseClientProvider

    init(provider: SupabaseClientProvider = .shared) {
        self.provider = provider
    }

    func fetchWorkouts() async throws -> [Workout] {
        let rows: [WorkoutRow] = try await provider.client.database
            .from("workouts")
            .select()
            .execute()
            .value
        return rows.map { $0.toDomain() }
    }

    func upsert(_ workout: Workout, userId: String) async throws {
        let row = WorkoutRow.from(workout, userId: userId)
        try await provider.client.database
            .from("workouts")
            .upsert(row)
            .execute()
    }

    func delete(id: String) async throws {
        try await provider.client.database
            .from("workouts")
            .delete()
            .eq("id", value: id)
            .execute()
    }
}
