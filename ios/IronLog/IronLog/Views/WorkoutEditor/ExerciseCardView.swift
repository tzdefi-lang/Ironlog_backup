import SwiftUI

struct ExerciseCardView: View {
    @Binding var exercise: ExerciseInstance
    let exerciseDef: ExerciseDef?
    let unit: Unit
    let historicalPRs: [String: ExercisePR]
    let onAddSet: () -> Void
    let onDeleteSet: (String) -> Void
    let onRemoveExercise: () -> Void
    let onShowDetail: () -> Void

    @State private var isExpanded = true

    var body: some View {
        BotanicalCard {
            VStack(alignment: .leading, spacing: 10) {
                Button {
                    withAnimation(.spring(duration: 0.3, bounce: 0.16)) {
                        isExpanded.toggle()
                    }
                } label: {
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(exerciseDef?.name ?? "Unknown Exercise")
                                .font(.botanicalSemibold(18))
                                .foregroundStyle(Color.botanicalTextPrimary)
                            Text(exerciseDef?.category ?? "Other")
                                .font(.caption)
                                .foregroundStyle(Color.botanicalTextSecondary)
                        }

                        Spacer()

                        Image(systemName: "chevron.down")
                            .font(.system(size: 13, weight: .semibold))
                            .rotationEffect(.degrees(isExpanded ? 0 : -90))
                            .foregroundStyle(Color.botanicalTextSecondary)
                    }
                }
                .buttonStyle(.plain)

                HStack(spacing: 8) {
                    Button(action: onShowDetail) {
                        Image(systemName: "info.circle")
                            .foregroundStyle(Color.botanicalAccent)
                            .frame(width: 30, height: 30)
                    }
                    .buttonStyle(.plain)

                    Spacer()

                    Button(role: .destructive, action: onRemoveExercise) {
                        Image(systemName: "trash")
                            .frame(width: 30, height: 30)
                    }
                    .buttonStyle(.plain)
                }

                if isExpanded {
                    ForEach($exercise.sets) { $set in
                        SetRowView(set: $set, unit: unit, isPR: checkIfSetIsPR(set: set)) {
                            onDeleteSet(set.id)
                        }
                    }

                    BotanicalButton(title: "Add Set", variant: .secondary, action: onAddSet)
                }
            }
        }
    }

    private func checkIfSetIsPR(set: WorkoutSet) -> Bool {
        guard set.completed, set.weight > 0, set.reps > 0 else { return false }
        guard let defId = exerciseDef?.id else { return false }
        guard let record = historicalPRs[defId] else { return true }

        let current1RM = set.weight * (1 + Double(set.reps) / 30)
        return current1RM > record.maxEstimated1RM || set.weight > record.maxWeight
    }
}
