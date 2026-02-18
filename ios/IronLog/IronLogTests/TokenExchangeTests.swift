import XCTest
@testable import IronLog

final class TokenExchangeTests: XCTestCase {
    final class MockKeychain: KeychainClient {
        var storage: [String: String] = [:]

        @discardableResult
        func set(_ value: String, forKey key: String) -> Bool {
            storage[key] = value
            return true
        }

        func get(_ key: String) -> String? {
            storage[key]
        }

        @discardableResult
        func delete(_ key: String) -> Bool {
            storage.removeValue(forKey: key)
            return true
        }
    }

    func testPrivyDidToUUIDDeterministic() {
        let did = "did:privy:cmxxxxxxxxx"
        let value1 = TokenExchangeService.privyDidToUUID(did)
        let value2 = TokenExchangeService.privyDidToUUID(did)

        XCTAssertEqual(value1, value2)
        XCTAssertEqual(value1.count, 36)
        XCTAssertEqual(value1[value1.index(value1.startIndex, offsetBy: 14)], "4")
    }

    func testRestoreSessionReturnsValidSessionWhenExpiryIsMoreThanFiveMinutesAway() {
        let keychain = MockKeychain()
        let service = TokenExchangeService(keychain: keychain)
        let expiresAt = (Date().timeIntervalSince1970 * 1000) + (10 * 60 * 1000)
        keychain.set("jwt-value", forKey: "ironlog_supabase_jwt")
        keychain.set("user-id", forKey: "ironlog_user_id")
        keychain.set(String(expiresAt), forKey: "ironlog_jwt_expires_at")

        let restored = service.restoreSession()

        guard let restored else {
            XCTFail("Expected a restored session")
            return
        }

        XCTAssertEqual(restored.token, "jwt-value")
        XCTAssertEqual(restored.userId, "user-id")
        XCTAssertEqual(restored.expiresAt, expiresAt, accuracy: 1)
    }

    func testRestoreSessionClearsExpiredSessionWhenExpiryIsWithinFiveMinutes() {
        let keychain = MockKeychain()
        let service = TokenExchangeService(keychain: keychain)
        let expiresAt = (Date().timeIntervalSince1970 * 1000) + (2 * 60 * 1000)
        keychain.set("jwt-value", forKey: "ironlog_supabase_jwt")
        keychain.set("user-id", forKey: "ironlog_user_id")
        keychain.set(String(expiresAt), forKey: "ironlog_jwt_expires_at")

        let restored = service.restoreSession()

        XCTAssertNil(restored)
        XCTAssertNil(keychain.get("ironlog_supabase_jwt"))
        XCTAssertNil(keychain.get("ironlog_user_id"))
        XCTAssertNil(keychain.get("ironlog_jwt_expires_at"))
    }
}
