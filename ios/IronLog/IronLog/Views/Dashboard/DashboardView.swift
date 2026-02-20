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
    @State private var selectedTemplateId: String?
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

                if !store.templates.isEmpty {
                    BotanicalButton(title: "Start From Template", variant: .secondary) {
                        selectedTemplateId = store.templates.first?.id
                        showTemplatePicker = true
                    }
                }
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
        .sheet(isPresented: $showTemplatePicker) {
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Templates")
                            .font(.botanicalSemibold(15))
                            .foregroundStyle(Color.botanicalTextSecondary)

                        LazyVStack(spacing: 10) {
                            ForEach(store.templates) { template in
                                Button {
                                    withAnimation(BotanicalMotion.quick) {
                                        selectedTemplateId = template.id
                                    }
                                    HapticManager.shared.selection()
                                } label: {
                                    BotanicalCard {
                                        HStack {
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(template.name)
                                                    .font(.botanicalSemibold(16))
                                                    .foregroundStyle(Color.botanicalTextPrimary)
                                                Text("\(template.exercises.count) exercises")
                                                    .font(.botanicalBody(13))
                                                    .foregroundStyle(Color.botanicalTextSecondary)
                                            }
                                            Spacer()
                                            if selectedTemplateId == template.id {
                                                Image(systemName: "checkmark.circle.fill")
                                                    .foregroundStyle(Color.botanicalAccent)
                                            }
                                        }
                                    }
                                }
                                .buttonStyle(.plain)
                                .transition(.move(edge: .bottom).combined(with: .opacity))
                            }
                        }
                    }
                }
                .padding(.horizontal, BotanicalTheme.pagePadding)
                .padding(.vertical, 16)
                .background(Color.botanicalBackground.ignoresSafeArea())
                .navigationTitle("Template")
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Close") { showTemplatePicker = false }
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Start") {
                            guard let selectedTemplateId else { return }
                            Task {
                                let created = await store.startWorkoutFromTemplate(templateId: selectedTemplateId, targetDate: today)
                                if let created {
                                    store.openWorkout(id: created.id)
                                }
                                showTemplatePicker = false
                            }
                            HapticManager.shared.success()
                        }
                    }
                }
            }
        }
    }

    private var carousel: some View {
        VStack(alignment: .leading, spacing: 10) {
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

            HStack {
                ForEach(Array(carouselItems.indices), id: \.self) { index in
                    Capsule()
                        .fill(index == selectedCardIndex ? Color.botanicalAccent : Color.botanicalMuted)
                        .frame(width: index == selectedCardIndex ? 20 : 8, height: 8)
                        .animation(BotanicalMotion.quick, value: selectedCardIndex)
                }

                Spacer()

                Text("\(min(selectedCardIndex + 1, carouselItems.count))/\(carouselItems.count)")
                    .font(.botanicalSemibold(12))
                    .foregroundStyle(Color.botanicalTextSecondary)
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
