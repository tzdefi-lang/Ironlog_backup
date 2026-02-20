import Foundation
import Supabase

final class SupabaseClientProvider {
    static let shared = SupabaseClientProvider()
    private let lock = NSLock()
    private var _client: SupabaseClient
    private var _authToken: String?

    var client: SupabaseClient {
        lock.lock()
        defer { lock.unlock() }
        return _client
    }

    var currentAuthToken: String? {
        lock.lock()
        defer { lock.unlock() }
        return _authToken
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
        _authToken = jwt
        lock.unlock()
    }

    func clearAuthToken() {
        let newClient = SupabaseClient(supabaseURL: Constants.supabaseURL, supabaseKey: Constants.supabaseAnonKey)
        lock.lock()
        _client = newClient
        _authToken = nil
        lock.unlock()
    }
}
