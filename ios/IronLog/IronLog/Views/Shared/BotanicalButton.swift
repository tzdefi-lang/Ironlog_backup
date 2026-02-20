import SwiftUI

struct BotanicalButton: View {
    enum Variant {
        case primary
        case secondary
        case danger
    }

    let title: LocalizedStringKey
    let variant: Variant
    var disabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.botanicalSemibold(16))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .foregroundStyle(foreground)
                .background(background)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(disabled)
        .opacity(disabled ? 0.5 : 1)
    }

    private var foreground: Color {
        switch variant {
        case .primary: return .botanicalTextPrimary
        case .secondary: return .botanicalTextSecondary
        case .danger: return .botanicalDangerLight
        }
    }

    private var background: Color {
        switch variant {
        case .primary: return .botanicalAccent
        case .secondary: return .botanicalMuted
        case .danger: return .botanicalDanger.opacity(0.85)
        }
    }
}
