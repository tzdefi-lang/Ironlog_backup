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

    /// Progress of swipe from 0 (idle) to 1 (full delete threshold).
    private var swipeProgress: Double {
        min(1, Double(abs(rowOffset)) / Double(deleteTriggerDistance))
    }

    var body: some View {
        HStack(spacing: 8) {
            HStack(spacing: 8) {
                weightField
                repsField
            }
            .frame(maxWidth: .infinity)
            .offset(x: rowOffset)
            .animation(.spring(duration: 0.18, bounce: 0.12), value: rowOffset)

            actionCircle
        }
        .overlay(alignment: .topTrailing) {
            if isPR, set.completed, rowOffset == 0 {
                Text("PR")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.botanicalEmphasis)
                    .clipShape(Capsule())
                    .offset(x: -44, y: -8)
                    .transition(.opacity)
            }
        }
        .contentShape(Rectangle())
        .simultaneousGesture(rowSwipeGesture)
    }

    // MARK: - Action Circle (morphs between checkmark and delete)

    private var actionCircle: some View {
        Button {
            if swipeProgress > 0.3 {
                // If partially swiped, treat tap as delete
                triggerDelete()
            } else {
                set.completed.toggle()
                HapticManager.shared.medium()
            }
        } label: {
            ZStack {
                // Background circle — morphs from check state to delete state
                Circle()
                    .fill(circleBackground)
                    .frame(width: 44, height: 44)
                    .overlay(
                        Circle()
                            .stroke(circleBorder, lineWidth: 1.5)
                    )

                // Checkmark icon — fades out as user swipes
                if set.completed {
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.white)
                        .opacity(1 - swipeProgress)
                        .transition(.scale.combined(with: .opacity))
                }

                // Trash icon — fades in as user swipes
                Image(systemName: "trash.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.white)
                    .opacity(swipeProgress)
                    .scaleEffect(0.7 + 0.3 * swipeProgress)
            }
        }
        .buttonStyle(SetCircleButtonStyle())
        .accessibilityLabel(swipeProgress > 0.3 ? "Delete set" : "Mark set as completed")
        .accessibilityAddTraits(.isButton)
        .accessibilityValue(set.completed ? "Completed" : "Not completed")
        .animation(.spring(duration: 0.22, bounce: 0.3), value: set.completed)
        .animation(.interactiveSpring(duration: 0.12), value: swipeProgress)
    }

    private var circleBackground: Color {
        if swipeProgress > 0.5 {
            return Color.botanicalDanger
        } else if swipeProgress > 0 {
            return set.completed
                ? Color.botanicalSuccess.opacity(1 - swipeProgress * 1.5)
                : Color.botanicalDanger.opacity(swipeProgress * 1.5)
        } else {
            return set.completed ? Color.botanicalSuccess : Color.clear
        }
    }

    private var circleBorder: Color {
        if swipeProgress > 0.3 {
            return Color.botanicalDanger
        } else {
            return set.completed ? Color.botanicalSuccess : Color.botanicalBorderSubtle
        }
    }

    // MARK: - Input Fields

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

    // MARK: - Swipe Gesture

    private var rowSwipeGesture: some Gesture {
        DragGesture(minimumDistance: 16, coordinateSpace: .local)
            .onChanged { value in
                guard !isDeleting else { return }
                guard abs(value.translation.width) > abs(value.translation.height) * 1.2 else { return }

                if value.translation.width < 0 {
                    rowOffset = max(-maxSwipeOffset, value.translation.width)
                } else if rowOffset < 0 {
                    // Allow swiping back to close
                    rowOffset = min(0, rowOffset + value.translation.width)
                } else {
                    rowOffset = 0
                }
            }
            .onEnded { value in
                guard !isDeleting else { return }

                if value.translation.width <= -deleteTriggerDistance,
                   abs(value.translation.width) > abs(value.translation.height) * 1.2 {
                    triggerDelete()
                } else {
                    resetRowOffset()
                }
            }
    }

    private func triggerDelete() {
        guard !isDeleting else { return }
        isDeleting = true
        HapticManager.shared.rigid()
        withAnimation(.smooth(duration: 0.3)) {
            onDelete()
        }
    }

    private func resetRowOffset() {
        withAnimation(.spring(duration: 0.18, bounce: 0.12)) {
            rowOffset = 0
        }
    }
}

/// Plain button style that doesn't add system hit-test delays.
private struct SetCircleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.88 : 1.0)
            .animation(.spring(duration: 0.15), value: configuration.isPressed)
    }
}
