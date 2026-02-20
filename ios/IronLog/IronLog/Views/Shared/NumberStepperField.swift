import SwiftUI

struct NumberStepperField: View {
    @Binding var value: Double
    var step: Double = 1

    @State private var minusPressed = false
    @State private var plusPressed = false

    var body: some View {
        HStack(spacing: 8) {
            actionButton(systemName: "minus", isPressed: minusPressed) {
                withAnimation(BotanicalMotion.quick) {
                    value = max(0, value - step)
                }
                HapticManager.shared.light()
            }
            .simultaneousGesture(DragGesture(minimumDistance: 0)
                .onChanged { _ in minusPressed = true }
                .onEnded { _ in minusPressed = false })

            TextField("", value: $value, format: .number.precision(.fractionLength(0 ... 1)))
                .multilineTextAlignment(.center)
                .keyboardType(.decimalPad)
                .font(.botanicalSemibold(15))
                .frame(height: 44)
                .background(Color.botanicalBackground)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .contentTransition(.numericText())

            actionButton(systemName: "plus", isPressed: plusPressed) {
                withAnimation(BotanicalMotion.quick) {
                    value += step
                }
                HapticManager.shared.light()
            }
            .simultaneousGesture(DragGesture(minimumDistance: 0)
                .onChanged { _ in plusPressed = true }
                .onEnded { _ in plusPressed = false })
        }
        .padding(6)
        .background(Color.botanicalSurface)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.botanicalBorderSubtle, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func actionButton(systemName: String, isPressed: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color.botanicalTextPrimary)
                .frame(width: 44, height: 44)
                .background(Color.botanicalMuted.opacity(0.6))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .scaleEffect(isPressed ? 0.94 : 1)
                .animation(BotanicalMotion.quick, value: isPressed)
        }
        .buttonStyle(.plain)
    }
}
