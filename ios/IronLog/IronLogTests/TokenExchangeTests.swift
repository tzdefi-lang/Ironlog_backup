import XCTest
@testable import IronLog

final class TokenExchangeTests: XCTestCase {
    func testPrivyDidToUUIDDeterministic() {
        let did = "did:privy:cmxxxxxxxxx"
        let value1 = TokenExchangeService.privyDidToUUID(did)
        let value2 = TokenExchangeService.privyDidToUUID(did)

        XCTAssertEqual(value1, value2)
        XCTAssertEqual(value1.count, 36)
        XCTAssertEqual(value1[value1.index(value1.startIndex, offsetBy: 14)], "4")
    }
}
