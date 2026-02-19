import Foundation
import Supabase

final class SupabaseClientProvider {
    static let shared = SupabaseClientProvider()
    private let lock = NSLock()
    private var _client: SupabaseClient

    var client: SupabaseClient {
        lock.lock()
        defer { lock.unlock() }
        return _client
    }

    private init() {
        _client = SupabaseClient(supabaseURL: Constants.supabaseURL, supabaseKey: Constants.supabaseAnonKey)
    }

    func setAuthToken(_ jwt: String) {
        let newClient = SupabaseClient(
            supabaseURL: Constants.supabaseURL,
            supabaseKey: Constants.supabaseAnonKey,
            options: SupabaseClientOptions(
                db: .init(),
                global: .init(headers: ["Authorization": "Bearer \(jwt)"])
            )
        )

        lock.lock()
        _client = newClient
        lock.unlock()
    }

    func clearAuthToken() {
        let newClient = SupabaseClient(supabaseURL: Constants.supabaseURL, supabaseKey: Constants.supabaseAnonKey)
        lock.lock()
        _client = newClient
        lock.unlock()
    }
}
