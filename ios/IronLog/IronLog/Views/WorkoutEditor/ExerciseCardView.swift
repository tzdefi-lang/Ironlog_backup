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

    var body: some View {
        BotanicalCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    Button(action: onShowDetail) {
                        HStack(alignment: .top, spacing: 12) {
                            thumbnailView

                            VStack(alignment: .leading, spacing: 4) {
                                Text(exerciseDef?.name ?? "Unknown Exercise")
                                    .font(.botanicalSemibold(19))
                                    .foregroundStyle(Color.botanicalTextPrimary)

                                Text(subtitleText)
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(Color.botanicalTextSecondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Show exercise details for \(exerciseDef?.name ?? "exercise")")
                    .accessibilityIdentifier("exerciseCard.showDetailButton")

                    Spacer(minLength: 8)

                    Button(action: onRemoveExercise) {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.botanicalTextSecondary)
                            .frame(width: 44, height: 44)
                            .background(Color.botanicalMuted.opacity(0.55))
                            .clipShape(Circle())
                            .overlay(
                                Circle()
                                    .stroke(Color.botanicalBorderSubtle, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Remove exercise")
                }

                ForEach($exercise.sets) { $set in
                    SetRowView(set: $set, unit: unit, isPR: checkIfSetIsPR(set: set)) {
                        onDeleteSet(set.id)
                    }
                    .transition(
                        .asymmetric(
                            insertion: .move(edge: .bottom).combined(with: .opacity),
                            removal: .opacity.combined(with: .scale(scale: 0.92, anchor: .trailing))
                        )
                    )
                    .accessibilityIdentifier("exerciseCard.setRow")
                }
                .animation(.smooth(duration: 0.3), value: exercise.sets.map(\.id))

                BotanicalButton(title: "Add Set", variant: .secondary) {
                    withAnimation(.smooth(duration: 0.3)) {
                        onAddSet()
                    }
                    HapticManager.shared.light()
                }
                .accessibilityIdentifier("exerciseCard.addSetButton")
            }
        }
    }

    private var subtitleText: String {
        var parts: [String] = ["\(exercise.sets.count) Sets", exerciseDef?.category ?? "Other"]
        if exerciseDef?.usesBarbell == true {
            parts.append("Barbell")
        }
        if exerciseDef?.source == .official {
            parts.append("Official")
        }
        return parts.joined(separator: " • ")
    }

    @ViewBuilder
    private var thumbnailView: some View {
        if let url = previewURL {
            AsyncImage(url: url) { image in
                image
                    .resizable()
                    .scaledToFill()
            } placeholder: {
                Color.botanicalMuted
            }
            .frame(width: 56, height: 56)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        } else {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.botanicalMuted)
                .frame(width: 56, height: 56)
                .overlay(
                    Image(systemName: "figure.strengthtraining.traditional")
                        .foregroundStyle(Color.botanicalTextSecondary)
                )
        }
    }

    private var previewURL: URL? {
        if let thumb = exerciseDef?.thumbnailUrl, let url = URL(string: thumb) {
            return url
        }

        if let imageMedia = exerciseDef?.mediaItems.first(where: { $0.contentType == .image }),
           let url = URL(string: imageMedia.url) {
            return url
        }

        if let mediaURL = exerciseDef?.mediaUrl, let url = URL(string: mediaURL) {
            return url
        }

        return nil
    }

    private func checkIfSetIsPR(set: WorkoutSet) -> Bool {
        guard set.completed, set.weight > 0, set.reps > 0 else { return false }
        guard let defId = exerciseDef?.id else { return false }
        guard let record = historicalPRs[defId] else { return true }

        let current1RM = set.weight * (1 + Double(set.reps) / 30)
        return current1RM > record.maxEstimated1RM || set.weight > record.maxWeight
    }
}
