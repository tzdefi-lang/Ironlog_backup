import SwiftUI

struct SetRowView: View {
    @Binding var set: WorkoutSet
    let unit: Unit
    let isPR: Bool
    let onDelete: () -> Void

    @State private var rowOffset: CGFloat = 0
    @State private var isDeleting = false

    private let deleteTriggerDistance: CGFloat = 72
    private let maxSwipeOffset: CGFloat = 92

    var body: some View {
        ZStack(alignment: .trailing) {
            deleteBackground

            rowContent
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.botanicalSurface)
                .offset(x: rowOffset)
                .contentShape(Rectangle())
                .simultaneousGesture(rowSwipeGesture)
                .animation(.spring(duration: 0.24, bounce: 0.2), value: rowOffset)
        }
        .clipped()
    }

    private var rowContent: some View {
        HStack(spacing: 8) {
            HStack(spacing: 8) {
                weightField
                repsField
            }
            .frame(maxWidth: .infinity)

            Button {
                set.completed.toggle()
                HapticManager.shared.medium()
            } label: {
                ZStack {
                    Circle()
                        .fill(set.completed ? Color.botanicalSuccess : Color.clear)
                        .frame(width: 44, height: 44)
                        .overlay(
                            Circle()
                                .stroke(set.completed ? Color.botanicalSuccess : Color.botanicalBorderSubtle, lineWidth: 1.5)
                        )

                    if set.completed {
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.white)
                            .transition(.scale.combined(with: .opacity))
                    }
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Mark set as completed")
            .accessibilityAddTraits(.isButton)
            .accessibilityValue(set.completed ? "Completed" : "Not completed")
            .animation(.spring(duration: 0.22, bounce: 0.3), value: set.completed)
        }
        .overlay(alignment: .topTrailing) {
            if isPR, set.completed {
                Text("PR")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.botanicalEmphasis)
                    .clipShape(Capsule())
                    .offset(x: -44, y: -8)
            }
        }
    }

    private var weightField: some View {
        HStack(spacing: 6) {
            TextField("0", value: $set.weight, format: .number.precision(.fractionLength(0 ... 1)))
                .keyboardType(.decimalPad)
                .textFieldStyle(.plain)
                .multilineTextAlignment(.center)
                .font(.botanicalSemibold(18))
                .frame(maxWidth: .infinity)

            Text(unit.rawValue.uppercased())
                .font(.botanicalSemibold(12))
                .foregroundStyle(Color.botanicalTextSecondary)
        }
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity, minHeight: 46)
        .background(Color.botanicalSurface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(set.completed ? Color.botanicalSuccess.opacity(0.45) : Color.botanicalBorderSubtle, lineWidth: 1)
        )
    }

    private var repsField: some View {
        HStack(spacing: 6) {
            TextField("0", value: $set.reps, format: .number)
                .keyboardType(.numberPad)
                .textFieldStyle(.plain)
                .multilineTextAlignment(.center)
                .font(.botanicalSemibold(18))
                .frame(maxWidth: .infinity)

            Text("REPS")
                .font(.botanicalSemibold(12))
                .foregroundStyle(Color.botanicalTextSecondary)
        }
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity, minHeight: 46)
        .background(Color.botanicalSurface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(set.completed ? Color.botanicalSuccess.opacity(0.45) : Color.botanicalBorderSubtle, lineWidth: 1)
        )
    }

    private var deleteBackground: some View {
        HStack {
            Spacer()

            Image(systemName: "trash.fill")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color.botanicalDanger)
                .padding(.trailing, 14)
                .opacity(rowOffset < -10 ? 1 : 0)
                .animation(.easeOut(duration: 0.12), value: rowOffset)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.botanicalDangerLight.opacity(0.4))
    }

    private var rowSwipeGesture: some Gesture {
        DragGesture(minimumDistance: 12, coordinateSpace: .local)
            .onChanged { value in
                guard !isDeleting else { return }
                guard abs(value.translation.width) > abs(value.translation.height) else { return }

                if value.translation.width < 0 {
                    rowOffset = max(-maxSwipeOffset, value.translation.width)
                } else {
                    rowOffset = 0
                }
            }
            .onEnded { value in
                guard !isDeleting else { return }
                guard abs(value.translation.width) > abs(value.translation.height) else { return }

                if value.translation.width <= -deleteTriggerDistance {
                    triggerDelete()
                } else {
                    resetRowOffset()
                }
            }
    }

    private func triggerDelete() {
        isDeleting = true
        HapticManager.shared.rigid()
        rowOffset = -maxSwipeOffset

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
            onDelete()
        }
    }

    private func resetRowOffset() {
        rowOffset = 0
    }
}
