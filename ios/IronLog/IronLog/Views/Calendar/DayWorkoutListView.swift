import SwiftUI

struct DayWorkoutListView: View {
    let workouts: [Workout]
    let onOpen: (Workout) -> Void
    let onCopy: (Workout) -> Void
    let onDelete: (Workout) -> Void
    var onStartWorkout: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if workouts.isEmpty {
                EmptyStateView(
                    icon: "calendar.badge.plus",
                    title: "No workouts on this day",
                    description: "Start a new workout to log training for this date.",
                    actionTitle: onStartWorkout == nil ? nil : "Start Workout",
                    action: onStartWorkout
                )
            } else {
                ForEach(workouts) { workout in
                    SwipeToDeleteWorkoutCard(
                        workout: workout,
                        onOpen: { onOpen(workout) },
                        onCopy: { onCopy(workout) },
                        onDelete: { onDelete(workout) }
                    )
                }
                .animation(.spring(duration: 0.28, bounce: 0.18), value: workouts.map(\.id))
            }
        }
    }
}

private struct SwipeToDeleteWorkoutCard: View {
    let workout: Workout
    let onOpen: () -> Void
    let onCopy: () -> Void
    let onDelete: () -> Void

    @State private var rowOffset: CGFloat = 0
    @State private var isDeleting = false

    private let deleteTriggerDistance: CGFloat = 100
    private let maxSwipeOffset: CGFloat = 120

    var body: some View {
        ZStack(alignment: .trailing) {
            deleteBackground

            tappableCardContent
                .offset(x: rowOffset)
                .opacity(isDeleting ? 0 : 1)
                .scaleEffect(isDeleting ? 0.98 : 1)
                .contentShape(Rectangle())
                .simultaneousGesture(rowSwipeGesture)
                .onTapGesture {
                    guard !isDeleting else { return }
                    if rowOffset < 0 {
                        closeDeleteAction()
                    } else {
                        onOpen()
                    }
                }
                .animation(.spring(duration: 0.18, bounce: 0.12), value: rowOffset)
                .animation(.easeOut(duration: 0.18), value: isDeleting)
                .allowsHitTesting(!isDeleting)
        }
        .clipShape(RoundedRectangle(cornerRadius: BotanicalTheme.cardCornerRadius, style: .continuous))
    }

    private var tappableCardContent: some View {
        cardContent
    }

    private var cardContent: some View {
        BotanicalCard(elevated: true) {
            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    if !workout.completed, workout.startTimestamp != nil {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(Color.botanicalSuccess)
                                .frame(width: 6, height: 6)
                            Text("In Progress")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Color.botanicalSuccess)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.botanicalSuccess.opacity(0.12))
                        .clipShape(Capsule())
                        .accessibilityLabel("In Progress")
                    } else if workout.completed {
                        Text("Completed")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(Color.botanicalAccent)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.botanicalAccent.opacity(0.12))
                            .clipShape(Capsule())
                            .accessibilityLabel("Completed")
                    }

                    Text(workout.title)
                        .font(.botanicalSemibold(17))
                        .foregroundStyle(Color.botanicalTextPrimary)
                }

                Spacer()

                HStack(spacing: 4) {
                    Image(systemName: "figure.strengthtraining.traditional")
                        .font(.system(size: 11))
                    Text("\(workout.exercises.count)")
                        .font(.botanicalSemibold(13))
                }
                .foregroundStyle(Color.botanicalTextSecondary)

                Menu {
                    Button(action: onCopy) {
                        Label("Copy", systemImage: "doc.on.doc")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.botanicalTextSecondary)
                        .frame(width: 32, height: 32)
                        .background(Color.botanicalMuted.opacity(0.35))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Workout options")
            }
        }
    }

    private var deleteBackground: some View {
        RoundedRectangle(cornerRadius: BotanicalTheme.cardCornerRadius, style: .continuous)
            .fill(Color.botanicalDangerLight.opacity(0.45))
            .overlay(alignment: .trailing) {
                HStack(spacing: 6) {
                    Image(systemName: "trash.fill")
                        .font(.system(size: 14, weight: .semibold))
                    Text("Delete")
                        .font(.system(size: 13, weight: .semibold))
                }
                .foregroundStyle(Color.botanicalDanger)
                .padding(.trailing, 18)
                .opacity(rowOffset < -10 ? 1 : 0)
                .animation(.easeOut(duration: 0.12), value: rowOffset)
            }
    }

    private var rowSwipeGesture: some Gesture {
        DragGesture(minimumDistance: 20, coordinateSpace: .local)
            .onChanged { value in
                guard !isDeleting else { return }
                guard abs(value.translation.width) > abs(value.translation.height) * 1.5 else { return }

                if value.translation.width < 0 {
                    rowOffset = max(-maxSwipeOffset, value.translation.width)
                } else {
                    rowOffset = 0
                }
            }
            .onEnded { value in
                guard !isDeleting else { return }

                if value.translation.width <= -deleteTriggerDistance,
                   abs(value.translation.width) > abs(value.translation.height) * 1.5 {
                    triggerDelete()
                } else {
                    closeDeleteAction()
                }
            }
    }

    private func triggerDelete() {
        guard !isDeleting else { return }
        isDeleting = true
        HapticManager.shared.rigid()
        rowOffset = -360

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
            onDelete()
        }
    }

    private func closeDeleteAction() {
        rowOffset = 0
    }
}
