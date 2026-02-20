import SwiftUI

struct BotanicalCardModifier: ViewModifier {
    var cornerRadius: CGFloat = 24
    var elevated: Bool = false

    func body(content: Content) -> some View {
        content
            .background(Color.botanicalSurface)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .shadow(color: .black.opacity(elevated ? 0.05 : 0), radius: elevated ? 8 : 0, x: 0, y: elevated ? 4 : 0)
    }
}

struct PressableButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeOut(duration: 0.22), value: configuration.isPressed)
    }
}

/// A UIKit-level tap gesture recogniser that dismisses the keyboard without
/// blocking buttons, links, or other interactive child views.
struct KeyboardDismissModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(KeyboardDismissHelper())
    }
}

private struct KeyboardDismissHelper: UIViewRepresentable {
    func makeUIView(context: Context) -> UIView {
        let view = KeyboardDismissTapView()
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {}
}

/// A UIView that adds a tap gesture to its window to dismiss the keyboard.
/// Using the window-level gesture ensures it works regardless of the view's own frame.
private final class KeyboardDismissTapView: UIView {
    private var tapGesture: UITapGestureRecognizer?

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if let window, tapGesture == nil {
            let tap = UITapGestureRecognizer(target: self, action: #selector(dismissKeyboard))
            tap.cancelsTouchesInView = false
            window.addGestureRecognizer(tap)
            tapGesture = tap
        }
    }

    override func removeFromSuperview() {
        if let tap = tapGesture, let window {
            window.removeGestureRecognizer(tap)
        }
        tapGesture = nil
        super.removeFromSuperview()
    }

    @objc private func dismissKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

extension View {
    func botanicalCard(cornerRadius: CGFloat = 24, elevated: Bool = false) -> some View {
        modifier(BotanicalCardModifier(cornerRadius: cornerRadius, elevated: elevated))
    }

    func pressable() -> some View {
        buttonStyle(PressableButtonStyle())
    }

    /// Dismisses keyboard when tapping outside text fields, without blocking child gestures.
    func dismissKeyboardOnTap() -> some View {
        modifier(KeyboardDismissModifier())
    }
}
