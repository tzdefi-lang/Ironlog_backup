import SwiftUI

struct DayWorkoutListView: View {
    let workouts: [Workout]
    let onOpen: (Workout) -> Void
    let onCopy: (Workout) -> Void
    let onDelete: (Workout) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if workouts.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "calendar.badge.plus")
                        .font(.system(size: 32))
                        .foregroundStyle(Color.botanicalMuted)
                    Text("No workouts on this day")
                        .font(.botanicalBody(14))
                        .foregroundStyle(Color.botanicalTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.vertical, 32)
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
    @State private var isDeleteRevealed = false
    @State private var isDeleting = false

    private let deleteActionWidth: CGFloat = 92
    private let deleteTriggerDistance: CGFloat = 126

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
                    isDeleteRevealed ? closeDeleteAction() : onOpen()
                }
                .animation(.spring(duration: 0.24, bounce: 0.2), value: rowOffset)
                .animation(.easeOut(duration: 0.18), value: isDeleting)
                .allowsHitTesting(!isDeleting)
        }
        .clipShape(RoundedRectangle(cornerRadius: BotanicalTheme.cardCornerRadius, style: .continuous))
    }

    private var tappableCardContent: some View {
        ZStack(alignment: .topTrailing) {
            cardContent

            Menu {
                Button(action: onCopy) {
                    Label("Copy", systemImage: "doc.on.doc")
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.botanicalTextSecondary)
                    .frame(width: 28, height: 28)
                    .background(Color.botanicalMuted.opacity(0.45))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .padding(.top, 10)
            .padding(.trailing, 10)
        }
    }

    private var cardContent: some View {
        BotanicalCard(elevated: true) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
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
                        } else if workout.completed {
                            Text("Completed")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Color.botanicalAccent)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color.botanicalAccent.opacity(0.12))
                                .clipShape(Capsule())
                        }

                        Text(workout.title)
                            .font(.botanicalSemibold(17))
                            .foregroundStyle(Color.botanicalTextPrimary)
                    }

                    Spacer()

                    Text("\(workout.exercises.count) ex")
                        .font(.botanicalBody(13))
                        .foregroundStyle(Color.botanicalTextSecondary)
                        .padding(.trailing, 38)
                }
            }
        }
    }

    private var deleteBackground: some View {
        RoundedRectangle(cornerRadius: BotanicalTheme.cardCornerRadius, style: .continuous)
            .fill(Color.red.opacity(0.14))
            .overlay(alignment: .trailing) {
                HStack(spacing: 6) {
                    Image(systemName: "trash.fill")
                        .font(.system(size: 14, weight: .semibold))
                    Text("Delete")
                        .font(.system(size: 13, weight: .semibold))
                }
                .foregroundStyle(Color.red)
                .padding(.trailing, 18)
                .opacity(rowOffset < -10 ? 1 : 0)
                .animation(.easeOut(duration: 0.12), value: rowOffset)
            }
    }

    private var rowSwipeGesture: some Gesture {
        DragGesture(minimumDistance: 12, coordinateSpace: .local)
            .onChanged { value in
                guard !isDeleting else { return }
                guard abs(value.translation.width) > abs(value.translation.height) else { return }

                let anchoredOffset = isDeleteRevealed ? -deleteActionWidth : 0
                let nextOffset = anchoredOffset + value.translation.width
                rowOffset = min(0, max(-deleteActionWidth, nextOffset))
            }
            .onEnded { value in
                guard !isDeleting else { return }
                guard abs(value.translation.width) > abs(value.translation.height) else { return }

                let anchoredOffset = isDeleteRevealed ? -deleteActionWidth : 0
                let finalOffset = anchoredOffset + value.translation.width

                if finalOffset <= -deleteTriggerDistance {
                    triggerDelete()
                } else if finalOffset <= -deleteActionWidth * 0.45 {
                    revealDeleteAction()
                } else {
                    closeDeleteAction()
                }
            }
    }

    private func triggerDelete() {
        guard !isDeleting else { return }
        isDeleting = true
        UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
        rowOffset = -360

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
            onDelete()
        }
    }

    private func revealDeleteAction() {
        rowOffset = -deleteActionWidth
        isDeleteRevealed = true
    }

    private func closeDeleteAction() {
        rowOffset = 0
        isDeleteRevealed = false
    }
}
