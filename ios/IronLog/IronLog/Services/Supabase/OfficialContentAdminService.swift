import Foundation

enum OfficialContentAdminServiceError: LocalizedError {
    case unauthenticated
    case invalidResponse
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .unauthenticated:
            return "Please sign in before managing official content."
        case .invalidResponse:
            return "Invalid response from official content service."
        case .serverError(let message):
            return message
        }
    }
}

private struct OfficialContentAdminRequest<Payload: Encodable>: Encodable {
    let entity: String
    let action: String
    let payload: Payload
}

private struct OfficialExercisePayload: Encodable {
    let id: String
    let name: String
    let description: String
    let thumbnailUrl: String?
    let markdown: String
    let mediaItems: [ExerciseMediaItem]
    let category: String
    let usesBarbell: Bool
    let barbellWeight: Double
}

private struct OfficialTemplatePayload: Encodable {
    let id: String
    let name: String
    let description: String
    let tagline: String
    let exercises: [WorkoutTemplateExercise]
}

final class OfficialContentAdminService {
    private let provider: SupabaseClientProvider

    init(provider: SupabaseClientProvider = .shared) {
        self.provider = provider
    }

    func upsertOfficialExercise(_ def: ExerciseDef) async throws {
        let payload = OfficialExercisePayload(
            id: def.id,
            name: def.name,
            description: def.description,
            thumbnailUrl: def.thumbnailUrl,
            markdown: def.markdown,
            mediaItems: def.mediaItems,
            category: def.category,
            usesBarbell: def.usesBarbell,
            barbellWeight: def.barbellWeight
        )
        try await send(entity: "official_exercise", action: "upsert", payload: payload)
    }

    func upsertOfficialTemplate(_ template: WorkoutTemplate) async throws {
        let payload = OfficialTemplatePayload(
            id: template.id,
            name: template.name,
            description: template.description,
            tagline: template.tagline,
            exercises: template.exercises
        )
        try await send(entity: "official_template", action: "upsert", payload: payload)
    }

    private func send<Payload: Encodable>(entity: String, action: String, payload: Payload) async throws {
        guard let token = provider.currentAuthToken else {
            throw OfficialContentAdminServiceError.unauthenticated
        }

        let requestPayload = OfficialContentAdminRequest(entity: entity, action: action, payload: payload)

        var request = URLRequest(url: Constants.supabaseURL.appending(path: "/functions/v1/official-content-admin"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(Constants.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.httpBody = try JSONEncoder().encode(requestPayload)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw OfficialContentAdminServiceError.invalidResponse
        }

        guard 200 ..< 300 ~= http.statusCode else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw OfficialContentAdminServiceError.serverError(message ?? "Official content request failed")
        }
    }
}
