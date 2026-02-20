import SwiftUI
import UIKit

private struct ExerciseDetailPayload: Identifiable {
    let id: String
    let exercise: ExerciseInstance
    let def: ExerciseDef?
}

struct WorkoutEditorView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let workoutId: String?

    @State private var viewModel: WorkoutEditorViewModel?
    @State private var showExercisePicker = false
    @State private var showCreateExercise = false
    @State private var showRestTimer = false
    @State private var restTimerRestartToken = 0
    @State private var showReport = false
    @State private var editingDef: ExerciseDef?
    @State private var detailExercise: ExerciseDetailPayload?
    @State private var editMode: EditMode = .inactive
    @State private var cachedPRs: [String: ExercisePR] = [:]

    private var userUnit: Unit { store.user?.preferences.defaultUnit ?? .lbs }
    private var restTimerSeconds: Int { store.user?.preferences.restTimerSeconds ?? 90 }
    private var autoRestTimer: Bool { store.user?.preferences.autoRestTimer ?? true }

    var body: some View {
        Group {
            if let viewModel {
                editorBody(viewModel)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            } else {
                SkeletonView().padding(24)
            }
        }
        .animation(BotanicalMotion.standard, value: viewModel != nil)
        .onAppear {
            if viewModel == nil {
                let source = workoutId.flatMap { id in store.workouts.first(where: { $0.id == id }) }
                let draft = source ?? Workout(
                    id: UUID().uuidString,
                    date: DateUtils.formatDate(),
                    title: "New Workout",
                    note: "",
                    exercises: [],
                    completed: false,
                    elapsedSeconds: 0,
                    startTimestamp: nil
                )
                viewModel = WorkoutEditorViewModel(workout: draft)
            }
        }
        .task {
            // Pre-load exercise defs so the picker has data ready
            if store.exerciseDefs.isEmpty {
                await store.refreshData()
            }
            // If still empty (refreshData may have returned early), load official content directly
            if store.exerciseDefs.isEmpty {
                await store.refreshOfficialContent()
            }
            // Compute historical PRs once instead of every render
            if let viewModel {
                let otherWorkouts = store.workouts.filter { $0.id != viewModel.workout.id }
                cachedPRs = PRService.calculatePRs(workouts: otherWorkouts)
            }
        }
        .sheet(isPresented: $showExercisePicker) {
            ExercisePickerSheet(
                store: store,
                onSelect: { def in
                    viewModel?.addExercise(defId: def.id) { workout in
                        await persistWorkout(workout)
                    }
                },
                onEdit: { def in
                    withAnimation(BotanicalMotion.standard) {
                        showExercisePicker = false
                        editingDef = def
                    }
                },
                onDelete: { def in
                    await store.deleteExerciseDef(id: def.id)
                    store.pushToast("Exercise deleted")
                }
            )
        }
        .sheet(isPresented: $showCreateExercise) {
            CreateExerciseSheet { def in
                viewModel?.addExercise(defId: def.id) { workout in
                    await persistWorkout(workout)
                }
            }
        }
        .sheet(item: $editingDef) { def in
            EditExerciseSheet(exercise: def)
        }
        .sheet(item: $detailExercise) { payload in
            ExerciseDetailModal(exerciseDef: payload.def, currentExercise: payload.exercise, workouts: store.workouts)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showRestTimer) {
            RestTimerView(
                durationSeconds: restTimerSeconds,
                restartToken: restTimerRestartToken,
                onClose: { showRestTimer = false },
                onDurationChange: { store.setRestTimerSeconds($0) }
            )
        }
        .sheet(isPresented: $showReport) {
            if let viewModel {
                let historical = PRService.calculatePRs(workouts: store.workouts.filter { $0.id != viewModel.workout.id })
                SessionReportView(
                    workout: viewModel.workout,
                    durationMinutes: Int(viewModel.currentTime / 60),
                    completion: viewModel.completionPercent(),
                    volume: Int(viewModel.totalVolume()),
                    prBreaks: PRService.calculateBrokenPRs(workout: viewModel.workout, historical: historical, exerciseDefs: store.exerciseDefs)
                ) {
                    showReport = false
                    store.showWorkoutEditor = false
                    dismiss()
                }
            }
        }
    }

    @ViewBuilder
    private func editorBody(_ vm: WorkoutEditorViewModel) -> some View {
        VStack(spacing: 0) {
            HStack {
                Button {
                    let snapshot = vm.workout
                    store.showWorkoutEditor = false
                    dismiss()
                    Task { await persistWorkout(snapshot) }
                    HapticManager.shared.light()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.botanicalTextSecondary)
                        .frame(width: 44, height: 44)
                        .background(Color.botanicalMuted.opacity(0.5))
                        .clipShape(Circle())
                }
                .buttonStyle(PressableButtonStyle())
                .accessibilityLabel("Close workout editor")
                .accessibilityIdentifier("workoutEditor.closeButton")

                Spacer()

                VStack(spacing: 2) {
                    Text(DateUtils.formatDuration(vm.currentTime))
                        .font(.system(.title3, design: .monospaced).weight(.bold))
                        .foregroundStyle(vm.workout.startTimestamp == nil ? Color.botanicalTextSecondary : Color.botanicalSuccess)
                    Text(vm.workout.startTimestamp == nil ? "Paused" : "Running")
                        .font(.caption2)
                        .foregroundStyle(Color.botanicalTextSecondary)
                }

                Spacer()

                HStack(spacing: 10) {
                    headerActionButton(icon: "clock") {
                        showRestTimer = true
                        restTimerRestartToken += 1
                    }

                    headerActionButton(icon: vm.workout.startTimestamp == nil ? "play.fill" : "pause.fill") {
                        vm.toggleTimer { workout in
                            await persistWorkout(workout)
                        }
                    }

                    headerActionButton(icon: "line.3.horizontal") {
                        withAnimation(BotanicalMotion.quick) {
                            editMode = editMode == .active ? .inactive : .active
                        }
                        HapticManager.shared.selection()
                    }

                    Button {
                        Task {
                            if vm.workout.exercises.isEmpty {
                                if store.workouts.contains(where: { $0.id == vm.workout.id }) {
                                    await store.deleteWorkout(id: vm.workout.id)
                                }
                                store.showWorkoutEditor = false
                                dismiss()
                                return
                            }

                            await vm.completeWorkout { workout in
                                await persistWorkout(workout)
                            }
                            showReport = true
                            HapticManager.shared.success()
                        }
                    } label: {
                        Image(systemName: "checkmark")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                            .background(Color.botanicalEmphasis)
                            .clipShape(Circle())
                            .shadow(color: Color.botanicalEmphasis.opacity(0.4), radius: 8, x: 0, y: 4)
                    }
                    .buttonStyle(PressableButtonStyle())
                    .accessibilityLabel("Complete workout")
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial)

            List {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        TextField("Workout title", text: Binding(
                            get: { vm.workout.title },
                            set: { vm.setTitle($0) { workout in await persistWorkout(workout) } }
                        ))
                        .font(.display(BotanicalTheme.workoutTitleFontSize))
                        .foregroundStyle(Color.botanicalTextPrimary)
                        .padding(.vertical, 4)

                        TextField("Note", text: Binding(
                            get: { vm.workout.note },
                            set: { vm.setNote($0) { workout in await persistWorkout(workout) } }
                        ), axis: .vertical)
                        .padding(12)
                        .background(Color.botanicalSurface)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .listRowInsets(EdgeInsets(top: 14, leading: 20, bottom: 6, trailing: 20))
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .listSectionSeparator(.hidden)
                }

                Section {
                    ForEach(vm.workout.exercises) { exercise in
                        let def = store.exerciseDefs.first(where: { $0.id == exercise.defId })

                        ExerciseCardView(
                            exercise: binding(for: exercise, in: vm),
                            exerciseDef: def,
                            unit: userUnit,
                            historicalPRs: cachedPRs,
                            onAddSet: {
                                vm.addSet(exerciseId: exercise.id) { workout in
                                    await persistWorkout(workout)
                                }
                            },
                            onDeleteSet: { setId in
                                vm.deleteSet(exerciseId: exercise.id, setId: setId) { workout in
                                    await persistWorkout(workout)
                                }
                            },
                            onRemoveExercise: {
                                vm.removeExercise(exerciseId: exercise.id) { workout in
                                    await persistWorkout(workout)
                                }
                            },
                            onShowDetail: {
                                detailExercise = ExerciseDetailPayload(id: exercise.id, exercise: exercise, def: def)
                            },
                            onSetCompleted: autoRestTimer ? {
                                showRestTimer = true
                                restTimerRestartToken += 1
                            } : nil
                        )
                        .contentShape(.dragPreview, RoundedRectangle(cornerRadius: BotanicalTheme.cardCornerRadius, style: .continuous))
                        .listRowInsets(EdgeInsets(top: 6, leading: 20, bottom: 6, trailing: 20))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                    }
                    .onMove { from, to in
                        vm.workout.exercises.move(fromOffsets: from, toOffset: to)
                        vm.workout.exercises = vm.workout.exercises.enumerated().map { index, exercise in
                            var updated = exercise
                            updated.sortOrder = index
                            return updated
                        }
                        HapticManager.shared.medium()
                        Task { await persistWorkout(vm.workout) }
                    }
                }
                .listSectionSeparator(.hidden)

                Section {
                    BotanicalButton(title: "Add Exercise", variant: .secondary) {
                        Task {
                            if store.exerciseDefs.isEmpty {
                                await store.refreshData()
                            }
                            if store.exerciseDefs.isEmpty {
                                await store.refreshOfficialContent()
                            }
                            showExercisePicker = true
                        }
                    }
                    .listRowSeparator(.hidden)

                    BotanicalButton(title: "Create Exercise", variant: .secondary) {
                        showCreateExercise = true
                    }
                    .listRowSeparator(.hidden)

                    if vm.workout.completed {
                        BotanicalButton(title: "Resume Workout", variant: .primary) {
                            Task {
                                await vm.resumeWorkout { workout in
                                    await persistWorkout(workout)
                                }
                            }
                        }
                        .listRowSeparator(.hidden)
                    }
                }
                .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 8, trailing: 20))
                .listRowBackground(Color.clear)
                .listSectionSeparator(.hidden)
            }
            .listStyle(.plain)
            .listRowSeparator(.hidden)
            .scrollContentBackground(.hidden)
            .scrollIndicators(.hidden)
            .background(Color.clear)
            .environment(\.editMode, $editMode)
        }
        .safeAreaPadding(.top, 6)
        .background(Color.botanicalBackground.ignoresSafeArea())
        .dismissKeyboardOnTap()
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") {
                    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                }
            }
        }
    }

    private func headerActionButton(icon: String, color: Color = .botanicalTextPrimary, action: @escaping () -> Void) -> some View {
        Button {
            HapticManager.shared.light()
            action()
        } label: {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 40, height: 40)
                .background(Color.botanicalSurface)
                .clipShape(Circle())
                .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 2)
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityLabel(headerButtonAccessibilityLabel(icon))
    }

    private func binding(for exercise: ExerciseInstance, in vm: WorkoutEditorViewModel) -> Binding<ExerciseInstance> {
        Binding(
            get: {
                vm.workout.exercises.first(where: { $0.id == exercise.id }) ?? exercise
            },
            set: { updated in
                guard let index = vm.workout.exercises.firstIndex(where: { $0.id == exercise.id }) else { return }
                vm.workout.exercises[index] = updated
            }
        )
    }

    private func persistWorkout(_ workout: Workout) async {
        if store.workouts.contains(where: { $0.id == workout.id }) {
            await store.updateWorkout(workout)
        } else {
            await store.addWorkout(workout)
        }
    }

    private func headerButtonAccessibilityLabel(_ icon: String) -> String {
        switch icon {
        case "clock":
            return "Open rest timer"
        case "play.fill":
            return "Start timer"
        case "pause.fill":
            return "Pause timer"
        case "line.3.horizontal":
            return editMode == .active ? "Stop reordering exercises" : "Reorder exercises"
        default:
            return "Workout action"
        }
    }
}
