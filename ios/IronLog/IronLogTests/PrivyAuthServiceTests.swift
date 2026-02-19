import XCTest
@testable import IronLog

final class PrivyAuthServiceTests: XCTestCase {
    func testNonOAuthProvidersHaveNoOAuthProvider() {
        XCTAssertNil(PrivyLoginProvider.email.oauthProvider)
    }

    func testOAuthProvidersRemainMapped() {
        XCTAssertEqual(PrivyLoginProvider.google.oauthProvider, .google)
        XCTAssertEqual(PrivyLoginProvider.apple.oauthProvider, .apple)
    }

    func testAllCasesContainsEmail() {
        XCTAssertTrue(PrivyLoginProvider.allCases.contains(.email))
    }
}
