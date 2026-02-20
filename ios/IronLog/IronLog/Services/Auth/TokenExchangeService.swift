import CommonCrypto
import Foundation
import KeychainSwift

struct TokenExchangeResult: Codable, Sendable {
    let token: String
    let userId: String
    let expiresAt: Double
}

enum TokenExchangeError: Error {
    case invalidResponse
    case invalidJWT
    case serverError(String)
}

protocol KeychainClient {
    @discardableResult
    func set(_ value: String, forKey key: String) -> Bool
    func get(_ key: String) -> String?
    @discardableResult
    func delete(_ key: String) -> Bool
}

struct KeychainSwiftClient: KeychainClient {
    private let keychain = KeychainSwift()

    @discardableResult
    func set(_ value: String, forKey key: String) -> Bool {
        keychain.set(value, forKey: key, withAccess: nil)
    }

    func get(_ key: String) -> String? {
        keychain.get(key)
    }

    @discardableResult
    func delete(_ key: String) -> Bool {
        keychain.delete(key)
    }
}

final class TokenExchangeService {
    private var cache: (token: String, expiresAt: Double, sourceToken: String)?
    private let keychain: any KeychainClient

    init(keychain: any KeychainClient = KeychainSwiftClient()) {
        self.keychain = keychain
    }

    func exchange(privyToken: String) async throws -> TokenExchangeResult {
        if let cache,
           cache.sourceToken == privyToken,
           Date().timeIntervalSince1970 * 1000 < cache.expiresAt - 5 * 60 * 1000 {
            do {
                let userId = try extractUserId(from: cache.token)
                return TokenExchangeResult(token: cache.token, userId: userId, expiresAt: cache.expiresAt)
            } catch {
                AppLogger.auth.error("Invalid cached token payload, refreshing token: \((error as NSError).localizedDescription, privacy: .public)")
                self.cache = nil
            }
        }

        var request = URLRequest(url: Constants.supabaseURL.appending(path: "/functions/v1/token-exchange"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(Constants.supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.setValue(Constants.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["token": privyToken])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw TokenExchangeError.invalidResponse
        }

        if http.statusCode < 200 || http.statusCode >= 300 {
            let message = parseServerErrorMessage(from: data) ?? "Token exchange failed"
            throw TokenExchangeError.serverError(message)
        }

        let result = try JSONDecoder().decode(TokenExchangeResult.self, from: data)
        keychain.set(result.token, forKey: "ironlog_supabase_jwt")
        keychain.set(result.userId, forKey: "ironlog_user_id")
        keychain.set(String(result.expiresAt), forKey: "ironlog_jwt_expires_at")
        cache = (result.token, result.expiresAt, privyToken)
        return result
    }

    func clear() {
        cache = nil
        keychain.delete("ironlog_supabase_jwt")
        keychain.delete("ironlog_user_id")
        keychain.delete("ironlog_jwt_expires_at")
    }

    func restoreSession() -> TokenExchangeResult? {
        guard
            let token = keychain.get("ironlog_supabase_jwt"),
            let userId = keychain.get("ironlog_user_id"),
            let expiresAtString = keychain.get("ironlog_jwt_expires_at"),
            let expiresAt = Double(expiresAtString)
        else {
            return nil
        }

        let now = Date().timeIntervalSince1970 * 1000
        guard now < expiresAt - 5 * 60 * 1000 else {
            clear()
            return nil
        }

        return TokenExchangeResult(token: token, userId: userId, expiresAt: expiresAt)
    }

    func extractUserId(from jwt: String) throws -> String {
        let parts = jwt.split(separator: ".")
        guard parts.count == 3 else {
            throw TokenExchangeError.invalidJWT
        }

        var payload = String(parts[1])
        let remainder = payload.count % 4
        if remainder > 0 {
            payload += String(repeating: "=", count: 4 - remainder)
        }
        payload = payload.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")

        guard let data = Data(base64Encoded: payload) else {
            throw TokenExchangeError.invalidJWT
        }

        let jsonObject = try JSONSerialization.jsonObject(with: data)
        guard let json = jsonObject as? [String: Any],
              let sub = json["sub"] as? String else {
            throw TokenExchangeError.invalidJWT
        }
        return sub
    }

    private func parseServerErrorMessage(from data: Data) -> String? {
        do {
            let object = try JSONSerialization.jsonObject(with: data)
            guard let dictionary = object as? [String: Any],
                  let message = dictionary["error"] as? String else {
                return nil
            }
            let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        } catch {
            AppLogger.auth.debug("Failed to parse token exchange error payload: \((error as NSError).localizedDescription, privacy: .public)")
            return nil
        }
    }

    static func privyDidToUUID(_ did: String) -> String {
        let data = Data(did.utf8)
        var digest = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        data.withUnsafeBytes { ptr in
            _ = CC_SHA256(ptr.baseAddress, CC_LONG(data.count), &digest)
        }
        digest[6] = (digest[6] & 0x0F) | 0x40
        digest[8] = (digest[8] & 0x3F) | 0x80

        let hex = digest[0..<16].map { String(format: "%02x", $0) }.joined()
        return "\(hex.prefix(8))-\(hex.dropFirst(8).prefix(4))-\(hex.dropFirst(12).prefix(4))-\(hex.dropFirst(16).prefix(4))-\(hex.dropFirst(20).prefix(12))"
    }
}
