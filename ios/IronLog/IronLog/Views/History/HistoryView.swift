import SwiftUI

struct HistoryView: View {
    @Environment(AppStore.self) private var store
    @State private var viewModel = HistoryViewModel()

    private var filtered: [Workout] {
        store.workouts
            .filter { workout in
                let query = viewModel.searchText.trimmingCharacters(in: .whitespacesAndNewlines)
                let matchesQuery = query.isEmpty ||
                    workout.title.localizedCaseInsensitiveContains(query)

                let matchesStatus: Bool
                switch viewModel.status {
                case "completed":
                    matchesStatus = workout.completed
                case "in_progress":
                    matchesStatus = !workout.completed
                default:
                    matchesStatus = true
                }

                return matchesQuery && matchesStatus
            }
            .sorted { $0.date > $1.date }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("History")
                    .font(.display(40))

                TextField("Search workouts...", text: $viewModel.searchText)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(Color.botanicalSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(Color.botanicalBorderSubtle, lineWidth: 1)
                    )

                HStack(spacing: 8) {
                    statusButton(title: "All", value: "all")
                    statusButton(title: "Completed", value: "completed")
                    statusButton(title: "In Progress", value: "in_progress")
                }

                if filtered.isEmpty {
                    Text("No workouts found")
                        .font(.botanicalBody(14))
                        .foregroundStyle(Color.botanicalTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 24)
                }

                ForEach(filtered) { workout in
                    BotanicalCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Button {
                                store.openWorkout(id: workout.id)
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(workout.title)
                                        .font(.botanicalSemibold(17))
                                        .foregroundStyle(Color.botanicalTextPrimary)
                                    Text("\(workout.date) • \(workout.completed ? "Completed" : "In Progress")")
                                        .font(.caption)
                                        .foregroundStyle(Color.botanicalTextSecondary)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .buttonStyle(.plain)

                            HStack(spacing: 10) {
                                BotanicalButton(title: "Open", variant: .primary) {
                                    store.openWorkout(id: workout.id)
                                }

                                BotanicalButton(title: "Copy", variant: .secondary) {
                                    Task {
                                        await store.copyWorkout(workoutId: workout.id, targetDate: DateUtils.formatDate())
                                    }
                                }

                                Button(role: .destructive) {
                                    Task { await store.deleteWorkout(id: workout.id) }
                                } label: {
                                    Image(systemName: "trash")
                                        .foregroundStyle(.white)
                                        .frame(width: 42, height: 42)
                                        .background(Color.red)
                                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 20)
            .padding(.bottom, 120)
        }
        .background(Color.botanicalBackground.ignoresSafeArea())
    }

    private func statusButton(title: String, value: String) -> some View {
        Button(title) {
            viewModel.status = value
        }
        .font(.botanicalSemibold(13))
        .foregroundStyle(viewModel.status == value ? Color.botanicalTextPrimary : Color.botanicalTextSecondary)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(viewModel.status == value ? Color.botanicalAccent : Color.botanicalMuted.opacity(0.6))
        .clipShape(Capsule())
        .buttonStyle(.plain)
    }
}
