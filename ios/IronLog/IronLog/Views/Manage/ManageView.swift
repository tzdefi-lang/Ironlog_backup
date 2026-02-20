import SwiftUI

struct ManageView: View {
    @Environment(AppStore.self) private var store
    @State private var viewModel = ManageViewModel()

    @State private var exerciseName = ""
    @State private var templateName = ""

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
        List {
            Picker("Workspace", selection: $viewModel.tab) {
                Text("Exercises").tag(ManageViewModel.Tab.exercises)
                Text("Templates").tag(ManageViewModel.Tab.templates)
            }
            .pickerStyle(.segmented)

            if viewModel.tab == .exercises {
                Section("Official Exercises") {
                    ForEach(officialExercises) { exercise in
                        VStack(alignment: .leading) {
                            Text(exercise.name)
                            Text(exercise.category)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    TextField("New exercise name", text: $exerciseName)
                    Button("Save Exercise") {
                        Task {
                            await store.createOfficialExercise(name: exerciseName)
                            exerciseName = ""
                        }
                    }
                    .disabled(exerciseName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            } else {
                Section("Official Templates") {
                    ForEach(officialTemplates) { template in
                        VStack(alignment: .leading) {
                            Text(template.name)
                            Text("\(template.exercises.count) exercises")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    TextField("New template name", text: $templateName)
                    Button("Save Template") {
                        Task {
                            await store.createOfficialTemplate(name: templateName)
                            templateName = ""
                        }
                    }
                    .disabled(templateName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}
