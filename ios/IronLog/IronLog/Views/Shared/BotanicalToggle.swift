import SwiftUI

struct BotanicalToggle: View {
    @Binding var isOn: Bool
    var isEnabled: Bool = true
    var onToggle: ((Bool) -> Void)?

    var body: some View {
        Button {
            guard isEnabled else { return }
            let next = !isOn
            withAnimation(BotanicalMotion.spring) {
                isOn = next
            }
            onToggle?(next)
        } label: {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(isOn ? Color.botanicalAccent : Color.botanicalMuted)
                .frame(width: 52, height: 30)
                .overlay(alignment: isOn ? .trailing : .leading) {
                    Circle()
                        .fill(Color.botanicalSurface)
                        .frame(width: 24, height: 24)
                        .padding(.horizontal, 3)
                }
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Color.botanicalBorderSubtle, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .opacity(isEnabled ? 1 : 0.5)
    }
}
