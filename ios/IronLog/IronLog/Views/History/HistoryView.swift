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
                    HistoryWorkoutCard(
                        workout: workout,
                        onOpen: { store.openWorkout(id: workout.id) },
                        onDelete: {
                            withAnimation(.spring(duration: 0.35, bounce: 0.15)) {
                                Task { await store.deleteWorkout(id: workout.id) }
                            }
                            store.pushToast(L10n.string("history.workoutDeletedToast"))
                        }
                    )
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .animation(BotanicalMotion.standard.delay(Double(index) * 0.03), value: filtered.count)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 20)
            .padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
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

private struct HistoryWorkoutCard: View {
    let workout: Workout
    let onOpen: () -> Void
    let onDelete: () -> Void

    @State private var rowOffset: CGFloat = 0
    @State private var isDeleting = false

    private let deleteTriggerDistance: CGFloat = 80
    private let maxSwipeOffset: CGFloat = 100

    var body: some View {
        ZStack(alignment: .trailing) {
            HStack {
                Spacer()
                VStack(spacing: 4) {
                    Image(systemName: "trash.fill")
                        .font(.system(size: 16, weight: .bold))
                    Text("Delete")
                        .font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(Color.botanicalDanger)
                .padding(.trailing, 20)
                .opacity(rowOffset < -10 ? 1 : 0)
                .animation(.easeOut(duration: 0.12), value: rowOffset)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.botanicalDangerLight.opacity(0.4))
            .clipShape(RoundedRectangle(cornerRadius: BotanicalTheme.cardCornerRadius, style: .continuous))

            BotanicalCard {
                Button(action: onOpen) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(workout.title)
                            .font(.botanicalSemibold(17))
                            .foregroundStyle(Color.botanicalTextPrimary)

                        HStack(spacing: 8) {
                            Text(DateUtils.formatDisplayDate(workout.date))
                                .font(.botanicalBody(13))
                                .foregroundStyle(Color.botanicalTextSecondary)

                            Text("•")
                                .foregroundStyle(Color.botanicalMuted)

                            Text(workout.completed ? "Completed" : "In Progress")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(workout.completed ? Color.botanicalSuccess : Color.botanicalAccent)

                            Spacer()

                            Text(L10n.string("%@ exercises", "\(workout.exercises.count)"))
                                .font(.botanicalBody(13))
                                .foregroundStyle(Color.botanicalTextSecondary)
                        }

                        if !workout.exercises.isEmpty {
                            Text(exerciseSummary)
                                .font(.botanicalBody(12))
                                .foregroundStyle(Color.botanicalTextSecondary)
                                .lineLimit(1)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
            }
            .offset(x: rowOffset)
            .contentShape(Rectangle())
            .highPriorityGesture(swipeGesture)
            .animation(.spring(duration: 0.18, bounce: 0.12), value: rowOffset)
        }
        .clipped()
        .accessibilityIdentifier("history.workoutCard.\(workout.id)")
    }

    private var exerciseSummary: String {
        let completedSets = workout.exercises.flatMap(\.sets).filter(\.completed).count
        return L10n.string("%@ sets", "\(completedSets)")
    }

    private var swipeGesture: some Gesture {
        DragGesture(minimumDistance: 14, coordinateSpace: .local)
            .onChanged { value in
                guard !isDeleting else { return }
                guard abs(value.translation.width) > abs(value.translation.height) else { return }

                if value.translation.width < 0 {
                    rowOffset = max(-maxSwipeOffset, value.translation.width)
                } else {
                    rowOffset = 0
                }
            }
            .onEnded { value in
                guard !isDeleting else { return }

                if value.translation.width <= -deleteTriggerDistance,
                   abs(value.translation.width) > abs(value.translation.height) {
                    triggerDelete()
                } else {
                    rowOffset = 0
                }
            }
    }

    private func triggerDelete() {
        isDeleting = true
        HapticManager.shared.rigid()
        withAnimation(.spring(duration: 0.2)) {
            rowOffset = -maxSwipeOffset
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            onDelete()
        }
    }
}
