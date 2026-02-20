import SwiftUI

private enum DashboardCarouselItem: Identifiable {
    case today(Workout)
    case lastCompleted(Workout)
    case restDay

    var id: String {
        switch self {
        case .today(let workout):
            return "today-\(workout.id)"
        case .lastCompleted(let workout):
            return "last-\(workout.id)"
        case .restDay:
            return "rest-day"
        }
    }
}

struct DashboardView: View {
    @Environment(AppStore.self) private var store

    @State private var showTemplatePicker = false
    @State private var selectedCardIndex = 0

    private var today: String { DateUtils.formatDate() }

    private var carouselItems: [DashboardCarouselItem] {
        var items: [DashboardCarouselItem] = []

        if let todays = store.workouts.first(where: { $0.date == today && !$0.completed }) {
            items.append(.today(todays))
        } else {
            items.append(.restDay)
        }

        if let last = store.workouts
            .filter({ $0.completed && $0.date < today })
            .sorted(by: { $0.date > $1.date })
            .first {
            items.append(.lastCompleted(last))
        }

        return items
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Workout")
                    .font(.display(42))
                    .foregroundStyle(Color.botanicalTextPrimary)

                if store.isLoading, store.workouts.isEmpty {
                    LoadingStateView(message: "Loading workouts...")
                        .transition(.opacity)
                } else {
                    carousel
                }

                NavigationLink(destination: TemplatePickerView()) {
                    Text("Start From Template")
                        .font(.botanicalSemibold(16))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .foregroundStyle(Color.botanicalAccent)
                        .background(Color.botanicalAccent.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .buttonStyle(PressableButtonStyle())
            }
            .padding(.horizontal, BotanicalTheme.pagePadding)
            .padding(.top, 24)
            .padding(.bottom, 140)
            .animation(BotanicalMotion.standard, value: store.workouts.map(\.id))
        }
        .scrollIndicators(.hidden)
        .refreshable {
            await store.refreshData()
        }
        .background(Color.botanicalBackground.ignoresSafeArea())
        .task {
            if store.templates.isEmpty {
                await store.refreshOfficialContent()
            }
        }
    }

    private var carousel: some View {
        VStack(alignment: .leading, spacing: 4) {
            TabView(selection: $selectedCardIndex) {
                ForEach(Array(carouselItems.enumerated()), id: \.element.id) { index, item in
                    cardView(item)
                        .tag(index)
                        .padding(.horizontal, BotanicalTheme.pagePadding)
                        .padding(.vertical, 2)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 260)

            HStack(spacing: 6) {
                ForEach(Array(carouselItems.indices), id: \.self) { index in
                    Capsule()
                        .fill(index == selectedCardIndex ? Color.botanicalAccent : Color.botanicalMuted)
                        .frame(width: index == selectedCardIndex ? 20 : 8, height: 8)
                        .animation(BotanicalMotion.quick, value: selectedCardIndex)
                }
            }
            .padding(.horizontal, BotanicalTheme.pagePadding + 4)
        }
        .padding(.horizontal, -BotanicalTheme.pagePadding)
    }

    @ViewBuilder
    private func cardView(_ item: DashboardCarouselItem) -> some View {
        switch item {
        case .today(let workout):
            WorkoutCardView(
                workout: workout,
                subtitle: "Today",
                isInProgress: !workout.completed && workout.startTimestamp != nil,
                onOpen: { store.openWorkout(id: workout.id) },
                onCopy: {
                    Task { await store.copyWorkout(workoutId: workout.id, targetDate: today) }
                }
            )
        case .lastCompleted(let workout):
            WorkoutCardView(
                workout: workout,
                subtitle: "Last Completed",
                isInProgress: false,
                onOpen: { store.openWorkout(id: workout.id) },
                onCopy: {
                    Task { await store.copyWorkout(workoutId: workout.id, targetDate: today) }
                }
            )
        case .restDay:
            RestDayCardView { store.openNewWorkout() }
        }
    }
}
