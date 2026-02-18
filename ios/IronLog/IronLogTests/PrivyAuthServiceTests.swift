import XCTest
@testable import IronLog

final class PrivyAuthServiceTests: XCTestCase {
    func testNonOAuthProvidersHaveNoOAuthProvider() {
        XCTAssertNil(PrivyLoginProvider.email.oauthProvider)
        XCTAssertNil(PrivyLoginProvider.wallet.oauthProvider)
    }

    func testOAuthProvidersRemainMapped() {
        XCTAssertEqual(PrivyLoginProvider.google.oauthProvider, .google)
        XCTAssertEqual(PrivyLoginProvider.apple.oauthProvider, .apple)
    }

    func testAllCasesContainsEmailAndWallet() {
        XCTAssertTrue(PrivyLoginProvider.allCases.contains(.email))
        XCTAssertTrue(PrivyLoginProvider.allCases.contains(.wallet))
    }
}
