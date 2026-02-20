import SwiftUI

enum BotanicalTheme {
    static let controlCornerRadius: CGFloat = 18
    static let cardCornerRadius: CGFloat = 24
    static let pagePadding: CGFloat = 24
    static let chartPalette: [Color] = [
        Color(hex: "8C9A84"),
        Color(hex: "7F9B97"),
        Color(hex: "C27B66"),
        Color(hex: "6F8D73"),
        Color(hex: "AFBCAA"),
        Color(hex: "9FB298"),
        Color(hex: "D49B87"),
    ]
}

enum BotanicalMotion {
    static let quick = Animation.easeOut(duration: 0.22)
    static let standard = Animation.easeOut(duration: 0.36)
    static let slow = Animation.easeOut(duration: 0.50)
    static let spring = Animation.spring(duration: 0.36, bounce: 0.18)
}
