import SwiftUI

struct WorkoutCardView: View {
    let workout: Workout
    let subtitle: String
    let isInProgress: Bool
    let onOpen: () -> Void
    let onCopy: () -> Void

    var body: some View {
        BotanicalCard(elevated: true) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(subtitle)
                        .font(.botanicalSemibold(12))
                        .foregroundStyle(Color.botanicalTextSecondary)

                    Spacer()

                    if isInProgress {
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
                    }
                }

                Text(workout.title)
                    .font(.display(28))
                    .foregroundStyle(Color.botanicalTextPrimary)

                Text("\(workout.exercises.count) exercises")
                    .font(.botanicalBody(14))
                    .foregroundStyle(Color.botanicalTextSecondary)

                HStack(spacing: 10) {
                    BotanicalButton(title: "Open", variant: .primary, action: onOpen)
                    BotanicalButton(title: "Copy", variant: .secondary, action: onCopy)
                }
            }
        }
    }
}
