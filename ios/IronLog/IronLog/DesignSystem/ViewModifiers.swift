import SwiftUI

struct BotanicalCardModifier: ViewModifier {
    var cornerRadius: CGFloat = 24
    var elevated: Bool = false

    func body(content: Content) -> some View {
        content
            .background(Color.botanicalSurface)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .shadow(color: .black.opacity(elevated ? 0.09 : 0.06), radius: elevated ? 17 : 12, x: 0, y: elevated ? 7 : 4)
            .shadow(color: .black.opacity(elevated ? 0.05 : 0.04), radius: elevated ? 29 : 22, x: 0, y: elevated ? 15 : 8)
    }
}

struct PressableButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeOut(duration: 0.22), value: configuration.isPressed)
    }
}

extension View {
    func botanicalCard(cornerRadius: CGFloat = 24, elevated: Bool = false) -> some View {
        modifier(BotanicalCardModifier(cornerRadius: cornerRadius, elevated: elevated))
    }

    func pressable() -> some View {
        buttonStyle(PressableButtonStyle())
    }
}
