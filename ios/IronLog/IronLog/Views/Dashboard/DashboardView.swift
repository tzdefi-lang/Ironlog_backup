import SwiftUI

struct DashboardView: View {
    @Environment(AppStore.self) private var store

    @State private var showTemplatePicker = false
    @State private var selectedTemplateId: String?

    private var today: String { DateUtils.formatDate() }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Workout")
                    .font(.display(42))
                    .foregroundStyle(Color.botanicalTextPrimary)

                if let todays = store.workouts.first(where: { $0.date == today && !$0.completed }) {
                    WorkoutCardView(
                        workout: todays,
                        subtitle: "Today",
                        isInProgress: !todays.completed && todays.startTimestamp != nil,
                        onOpen: { store.openWorkout(id: todays.id) },
                        onCopy: {
                            Task { await store.copyWorkout(workoutId: todays.id, targetDate: today) }
                        }
                    )
                } else {
                    RestDayCardView { store.openNewWorkout() }
                }

                if let last = store.workouts.filter({ $0.completed && $0.date < today }).sorted(by: { $0.date > $1.date }).first {
                    WorkoutCardView(
                        workout: last,
                        subtitle: "Last Completed",
                        isInProgress: false,
                        onOpen: { store.openWorkout(id: last.id) },
                        onCopy: {
                            Task { await store.copyWorkout(workoutId: last.id, targetDate: today) }
                        }
                    )
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
        }
        .background(Color.botanicalBackground.ignoresSafeArea())
        .sheet(isPresented: $showTemplatePicker) {
            NavigationStack {
                List {
                    Section("Templates") {
                        ForEach(store.templates) { template in
                            Button {
                                selectedTemplateId = template.id
                            } label: {
                                HStack {
                                    VStack(alignment: .leading) {
                                        Text(template.name)
                                        Text("\(template.exercises.count) exercises")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    if selectedTemplateId == template.id {
                                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.botanicalAccent)
                                    }
                                }
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
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
                        }
                    }
                }
            }
        }
    }
}
