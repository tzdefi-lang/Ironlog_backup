import SwiftUI

enum BotanicalTheme {
    static let controlCornerRadius: CGFloat = 18
    static let cardCornerRadius: CGFloat = 24
    static let pagePadding: CGFloat = 24
}

enum BotanicalMotion {
    static let quick = Animation.easeOut(duration: 0.22)
    static let standard = Animation.easeOut(duration: 0.36)
    static let slow = Animation.easeOut(duration: 0.50)
    static let spring = Animation.spring(duration: 0.36, bounce: 0.18)
}
