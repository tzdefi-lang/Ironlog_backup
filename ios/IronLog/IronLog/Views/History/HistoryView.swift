import SwiftUI

struct HistoryView: View {
    @Environment(AppStore.self) private var store
    @State private var viewModel = HistoryViewModel()
    @State private var showFilterSheet = false

    private var bodyPartByDefID: [String: String] {
        Dictionary(uniqueKeysWithValues: store.exerciseDefs.map { ($0.id, $0.category) })
    }

    private var availableYears: [Int] {
        let years = store.workouts.map {
            Calendar.current.component(.year, from: DateUtils.parseDate($0.date))
        }
        return Array(Set(years)).sorted(by: >)
    }

    private var availableBodyParts: [String] {
        let parts = store.exerciseDefs.map(\.category)
        return Array(Set(parts)).sorted()
    }

    private var filtered: [Workout] {
        store.workouts
            .filter { workout in
                let query = viewModel.searchText.trimmingCharacters(in: .whitespacesAndNewlines)
                let matchesQuery = query.isEmpty || workout.title.localizedCaseInsensitiveContains(query)

                let matchesStatus: Bool
                switch viewModel.status {
                case "completed":
                    matchesStatus = workout.completed
                case "in_progress":
                    matchesStatus = !workout.completed
                default:
                    matchesStatus = true
                }

                let workoutDate = DateUtils.parseDate(workout.date)
                let components = Calendar.current.dateComponents([.year, .month], from: workoutDate)
                let matchesYear = viewModel.selectedYear == nil || components.year == viewModel.selectedYear
                let matchesMonth = viewModel.selectedMonth == nil || components.month == viewModel.selectedMonth

                let workoutParts = Set(
                    workout.exercises
                        .compactMap { bodyPartByDefID[$0.defId] }
                )
                let matchesBodyPart = viewModel.selectedBodyParts.isEmpty || !workoutParts.intersection(viewModel.selectedBodyParts).isEmpty

                return matchesQuery && matchesStatus && matchesYear && matchesMonth && matchesBodyPart
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

                    Button {
                        showFilterSheet = true
                        HapticManager.shared.selection()
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "line.3.horizontal.decrease.circle")
                            Text("Filters")
                        }
                        .font(.botanicalSemibold(13))
                        .foregroundStyle(Color.botanicalTextPrimary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(Color.botanicalAccent)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }

                if viewModel.hasAdvancedFilters {
                    activeFilterChips
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
        .sheet(isPresented: $showFilterSheet) {
            HistoryFilterSheet(
                query: $viewModel.searchText,
                status: $viewModel.status,
                selectedYear: $viewModel.selectedYear,
                selectedMonth: $viewModel.selectedMonth,
                selectedBodyParts: $viewModel.selectedBodyParts,
                availableYears: availableYears,
                availableBodyParts: availableBodyParts
            )
            .presentationDetents([.medium, .large])
        }
    }

    private var activeFilterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if let year = viewModel.selectedYear {
                    removableChip(title: "Year: \(year)") {
                        viewModel.selectedYear = nil
                    }
                }

                if let month = viewModel.selectedMonth {
                    removableChip(title: "Month: \(monthTitle(month))") {
                        viewModel.selectedMonth = nil
                    }
                }

                if viewModel.status != "all" {
                    removableChip(title: "Status: \(statusTitle(viewModel.status))") {
                        viewModel.status = "all"
                    }
                }

                ForEach(Array(viewModel.selectedBodyParts).sorted(), id: \.self) { part in
                    removableChip(title: part) {
                        viewModel.selectedBodyParts.remove(part)
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func removableChip(title: String, onRemove: @escaping () -> Void) -> some View {
        Button {
            withAnimation(BotanicalMotion.quick) {
                onRemove()
            }
            HapticManager.shared.selection()
        } label: {
            HStack(spacing: 6) {
                Text(title)
                Image(systemName: "xmark.circle.fill")
            }
            .font(.botanicalSemibold(12))
            .foregroundStyle(Color.botanicalTextPrimary)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color.botanicalAccent.opacity(0.85))
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
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

    private func monthTitle(_ month: Int) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"
        let components = DateComponents(year: 2026, month: month, day: 1)
        return Calendar(identifier: .gregorian).date(from: components).map(formatter.string(from:)) ?? "M\(month)"
    }

    private func statusTitle(_ value: String) -> String {
        switch value {
        case "completed":
            return "Completed"
        case "in_progress":
            return "In Progress"
        default:
            return "All"
        }
    }
}
