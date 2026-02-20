import Foundation

final class WorkoutRepository {
    private let provider: SupabaseClientProvider

    init(provider: SupabaseClientProvider = .shared) {
        self.provider = provider
    }

    func fetchWorkouts(limit: Int = 200, offset: Int = 0) async throws -> [Workout] {
        let safeLimit = max(1, limit)
        let safeOffset = max(0, offset)
        let rows: [WorkoutRow] = try await provider.client.database
            .from("workouts")
            .select()
            .order("date", ascending: false)
            .range(from: safeOffset, to: safeOffset + safeLimit - 1)
            .execute()
            .value
        AppLogger.repository.debug("Fetched workouts count=\(rows.count, privacy: .public) offset=\(safeOffset, privacy: .public) limit=\(safeLimit, privacy: .public)")
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
