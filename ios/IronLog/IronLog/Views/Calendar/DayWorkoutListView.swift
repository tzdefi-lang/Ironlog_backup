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
                            }

                            HStack(spacing: 8) {
                                BotanicalButton(title: "Open", variant: .primary) {
                                    onOpen(workout)
                                }

                                BotanicalButton(title: "Copy", variant: .secondary) {
                                    onCopy(workout)
                                }

                                BotanicalButton(title: "Delete", variant: .danger) {
                                    onDelete(workout)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
