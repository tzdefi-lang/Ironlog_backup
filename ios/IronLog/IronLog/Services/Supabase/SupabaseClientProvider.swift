import Foundation
import Supabase

final class SupabaseClientProvider {
    static let shared = SupabaseClientProvider()

    private(set) var client: SupabaseClient

    private init() {
        client = SupabaseClient(supabaseURL: Constants.supabaseURL, supabaseKey: Constants.supabaseAnonKey)
    }

    func setAuthToken(_ jwt: String) {
        client = SupabaseClient(
            supabaseURL: Constants.supabaseURL,
            supabaseKey: Constants.supabaseAnonKey,
            options: SupabaseClientOptions(
                db: .init(),
                global: .init(headers: ["Authorization": "Bearer \(jwt)"])
            )
        )
    }

    func clearAuthToken() {
        client = SupabaseClient(supabaseURL: Constants.supabaseURL, supabaseKey: Constants.supabaseAnonKey)
    }
}
