import SwiftUI

struct SetRowView: View {
    @Binding var set: WorkoutSet
    let unit: Unit
    let isPR: Bool
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Button {
                set.completed.toggle()
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            } label: {
                ZStack {
                    Circle()
                        .fill(set.completed ? Color.botanicalSuccess : Color.clear)
                        .frame(width: 28, height: 28)
                        .overlay(
                            Circle()
                                .stroke(set.completed ? Color.botanicalSuccess : Color.botanicalBorderSubtle, lineWidth: 2)
                        )

                    if set.completed {
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.white)
                    }
                }
            }
            .buttonStyle(.plain)
            .animation(.spring(duration: 0.22, bounce: 0.3), value: set.completed)

            TextField("0", value: $set.weight, format: .number.precision(.fractionLength(0 ... 1)))
                .keyboardType(.decimalPad)
                .textFieldStyle(.plain)
                .multilineTextAlignment(.center)
                .font(.botanicalSemibold(16))
                .frame(width: 80, height: 44)
                .background(Color.botanicalSurface)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(set.completed ? Color.botanicalSuccess.opacity(0.45) : Color.botanicalBorderSubtle, lineWidth: 1)
                )

            Text(unit.rawValue.uppercased())
                .font(.caption)
                .foregroundStyle(Color.botanicalTextSecondary)

            TextField("0", value: $set.reps, format: .number)
                .keyboardType(.numberPad)
                .textFieldStyle(.plain)
                .multilineTextAlignment(.center)
                .font(.botanicalSemibold(16))
                .frame(width: 64, height: 44)
                .background(Color.botanicalSurface)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(set.completed ? Color.botanicalSuccess.opacity(0.45) : Color.botanicalBorderSubtle, lineWidth: 1)
                )

            if isPR, set.completed {
                Text("PR")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.botanicalEmphasis)
                    .clipShape(Capsule())
            }

            Spacer(minLength: 0)

            Button(role: .destructive, action: onDelete) {
                Image(systemName: "trash")
            }
            .buttonStyle(.plain)
            .frame(width: 28, height: 28)
        }
    }
}
