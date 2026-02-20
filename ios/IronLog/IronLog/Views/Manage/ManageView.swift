import SwiftUI

struct ManageView: View {
    @Environment(AppStore.self) private var store
    @State private var viewModel = ManageViewModel()

    @State private var exerciseName = ""
    @State private var templateName = ""

    private let tabs: [ManageViewModel.Tab] = [.exercises, .templates]

    private var officialExercises: [ExerciseDef] {
        store.exerciseDefs.filter { $0.source == .official }
    }

    private var officialTemplates: [WorkoutTemplate] {
        store.templates.filter { $0.source == .official }
    }

    var body: some View {
        Group {
            if store.isAdmin {
                content
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "lock.shield")
                        .font(.system(size: 38))
                    Text("Admin only")
                        .font(.botanicalSemibold(18))
                    Text("Manage is available for allowlisted admin emails.")
                        .font(.botanicalBody(14))
                        .foregroundStyle(Color.botanicalTextSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(24)
            }
        }
        .navigationTitle("Manage")
        .background(Color.botanicalBackground.ignoresSafeArea())
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                BotanicalSegmentedControl(
                    options: tabs,
                    selection: $viewModel.tab,
                    title: tabTitle
                )

                if viewModel.tab == .exercises {
                    exerciseSection
                } else {
                    templateSection
                }
            }
            .padding(.horizontal, BotanicalTheme.pagePadding)
            .padding(.top, 16)
            .padding(.bottom, 36)
        }
    }

    private var exerciseSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Official Exercises")

            BotanicalCard {
                VStack(spacing: 10) {
                    TextField("New exercise name", text: $exerciseName)
                        .textFieldStyle(.plain)
                        .padding(12)
                        .background(Color.botanicalBackground)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    BotanicalButton(title: "Save Exercise", variant: .primary) {
                        Task {
                            await store.createOfficialExercise(name: exerciseName)
                            exerciseName = ""
                        }
                    }
                    .disabled(exerciseName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }

            if officialExercises.isEmpty {
                EmptyStateView(
                    icon: "figure.strengthtraining.traditional",
                    title: "No official exercises yet",
                    description: "Create your first official exercise to make it available to all users."
                )
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(officialExercises) { exercise in
                        BotanicalCard {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(exercise.name)
                                    .font(.botanicalSemibold(16))
                                    .foregroundStyle(Color.botanicalTextPrimary)
                                Text(exercise.category)
                                    .font(.botanicalBody(13))
                                    .foregroundStyle(Color.botanicalTextSecondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }
        }
    }

    private var templateSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Official Templates")

            BotanicalCard {
                VStack(spacing: 10) {
                    TextField("New template name", text: $templateName)
                        .textFieldStyle(.plain)
                        .padding(12)
                        .background(Color.botanicalBackground)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    BotanicalButton(title: "Save Template", variant: .primary) {
                        Task {
                            await store.createOfficialTemplate(name: templateName)
                            templateName = ""
                        }
                    }
                    .disabled(templateName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }

            if officialTemplates.isEmpty {
                EmptyStateView(
                    icon: "square.stack.3d.up",
                    title: "No official templates yet",
                    description: "Create your first official template to share standard plans."
                )
            } else {
                LazyVStack(spacing: 10) {
                    ForEach(officialTemplates) { template in
                        BotanicalCard {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(template.name)
                                    .font(.botanicalSemibold(16))
                                    .foregroundStyle(Color.botanicalTextPrimary)
                                Text("\(template.exercises.count) exercises")
                                    .font(.botanicalBody(13))
                                    .foregroundStyle(Color.botanicalTextSecondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }
        }
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.botanicalSemibold(15))
            .foregroundStyle(Color.botanicalTextSecondary)
    }

    private func tabTitle(_ tab: ManageViewModel.Tab) -> String {
        switch tab {
        case .exercises:
            return "Exercises"
        case .templates:
            return "Templates"
        }
    }
}
