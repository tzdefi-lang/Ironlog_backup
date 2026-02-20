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

                BotanicalSearchField(placeholder: "Search workouts...", text: $viewModel.searchText)

                HStack(spacing: 8) {
                    statusButton(title: "All", value: "all")
                    statusButton(title: "Completed", value: "completed")
                    statusButton(title: "In Progress", value: "in_progress")
                }

                if store.isLoading {
                    LoadingStateView(message: "Loading history...")
                } else if let error = store.authError, filtered.isEmpty {
                    ErrorStateView(
                        title: "Unable to load history",
                        message: LocalizedStringKey(error),
                        onRetry: {
                            Task { await store.refreshData() }
                        }
                    )
                } else if filtered.isEmpty {
                    EmptyStateView(
                        icon: "clock.arrow.trianglehead.counterclockwise.rotate.90",
                        title: "No workouts found",
                        description: "Try changing your filters or start your first session."
                    )
                }

                ForEach(Array(filtered.enumerated()), id: \.element.id) { index, workout in
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
                                        .frame(width: 44, height: 44)
                                        .background(Color.botanicalDanger)
                                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Delete workout")
                            }
                        }
                    }
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .animation(BotanicalMotion.standard.delay(Double(index) * 0.03), value: filtered.count)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 20)
            .padding(.bottom, 120)
        }
        .refreshable {
            await store.refreshData()
        }
        .background(Color.botanicalBackground.ignoresSafeArea())
    }

    private func statusButton(title: String, value: String) -> some View {
        Button(title) {
            withAnimation(BotanicalMotion.quick) {
                viewModel.status = value
            }
            HapticManager.shared.selection()
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
