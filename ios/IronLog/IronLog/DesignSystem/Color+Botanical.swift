import SwiftUI

extension Color {
    static let botanicalBackground = Color("BotanicalBackground")
    static let botanicalSurface = Color("BotanicalSurface")
    static let botanicalMuted = Color("BotanicalMuted")
    static let botanicalAccent = Color("BotanicalAccent")
    static let botanicalEmphasis = Color("BotanicalEmphasis")
    static let botanicalSuccess = Color("BotanicalSuccess")
    static let botanicalTextPrimary = Color("BotanicalTextPrimary")
    static let botanicalTextSecondary = Color("BotanicalTextSecondary")
    static let botanicalBorderSubtle = Color("BotanicalBorderSubtle")

    init(hex: String) {
        let clean = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: clean).scanHexInt64(&int)

        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8) & 0xFF) / 255
        let b = Double(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
