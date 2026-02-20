import Foundation
import Observation

@MainActor
@Observable
final class WorkoutEditorViewModel {
    var workout: Workout
    var currentTime: Double = 0
    var restTimerVisible = false

    private var timerTask: Task<Void, Never>?
    private var autosaveTask: Task<Void, Never>?

    init(workout: Workout) {
        self.workout = workout
        recalculateTime()
        startTimerIfNeeded()
    }

    func setTitle(_ title: String, onAutosave: @escaping (Workout) async -> Void) {
        workout.title = title
        scheduleAutosave(onAutosave: onAutosave)
    }

    func setNote(_ note: String, onAutosave: @escaping (Workout) async -> Void) {
        workout.note = note
        scheduleAutosave(onAutosave: onAutosave)
    }

    func toggleTimer(onPersist: @escaping (Workout) async -> Void) {
        if workout.completed { return }
        if let start = workout.startTimestamp {
            let elapsed = Date().timeIntervalSince1970 * 1000 - start
            workout.elapsedSeconds += elapsed / 1000
            workout.startTimestamp = nil
        } else {
            workout.startTimestamp = Date().timeIntervalSince1970 * 1000
        }
        recalculateTime()
        startTimerIfNeeded()
        Task { await onPersist(workout) }
    }

    func completeWorkout(onPersist: @escaping (Workout) async -> Void) async {
        if let start = workout.startTimestamp {
            let elapsed = Date().timeIntervalSince1970 * 1000 - start
            workout.elapsedSeconds += elapsed / 1000
        }
        workout.startTimestamp = nil
        workout.completed = true
        recalculateTime()
        await onPersist(workout)
    }

    func resumeWorkout(onPersist: @escaping (Workout) async -> Void) async {
        workout.completed = false
        await onPersist(workout)
    }

    func addExercise(defId: String, onAutosave: @escaping (Workout) async -> Void) {
        let exercise = ExerciseInstance(
            id: UUID().uuidString,
            defId: defId,
            sets: [WorkoutSet(id: UUID().uuidString, weight: 0, reps: 0, completed: false)],
            sortOrder: workout.exercises.count
        )
        workout.exercises.append(exercise)
        normalizeExerciseOrder()
        scheduleAutosave(onAutosave: onAutosave)
    }

    func removeExercise(exerciseId: String, onAutosave: @escaping (Workout) async -> Void) {
        workout.exercises.removeAll { $0.id == exerciseId }
        normalizeExerciseOrder()
        scheduleAutosave(onAutosave: onAutosave)
    }

    func addSet(exerciseId: String, onAutosave: @escaping (Workout) async -> Void) {
        guard let idx = workout.exercises.firstIndex(where: { $0.id == exerciseId }) else { return }
        let last = workout.exercises[idx].sets.last
        workout.exercises[idx].sets.append(
            WorkoutSet(id: UUID().uuidString, weight: last?.weight ?? 0, reps: last?.reps ?? 0, completed: false)
        )
        scheduleAutosave(onAutosave: onAutosave)
    }

    func deleteSet(exerciseId: String, setId: String, onAutosave: @escaping (Workout) async -> Void) {
        guard let idx = workout.exercises.firstIndex(where: { $0.id == exerciseId }) else { return }
        workout.exercises[idx].sets.removeAll { $0.id == setId }
        if workout.exercises[idx].sets.isEmpty {
            workout.exercises[idx].sets = [WorkoutSet(id: UUID().uuidString, weight: 0, reps: 0, completed: false)]
        }
        scheduleAutosave(onAutosave: onAutosave)
    }

    func updateSet(exerciseId: String, setId: String, transform: (inout WorkoutSet) -> Void, onAutosave: @escaping (Workout) async -> Void) {
        guard let eIdx = workout.exercises.firstIndex(where: { $0.id == exerciseId }),
              let sIdx = workout.exercises[eIdx].sets.firstIndex(where: { $0.id == setId }) else { return }

        transform(&workout.exercises[eIdx].sets[sIdx])
        scheduleAutosave(onAutosave: onAutosave)
    }

    func totalVolume() -> Double {
        workout.exercises
            .flatMap(\.sets)
            .filter(\.completed)
            .reduce(0) { $0 + $1.weight * Double($1.reps) }
    }

    func completionPercent() -> Int {
        let total = workout.exercises.flatMap(\.sets).count
        let completed = workout.exercises.flatMap(\.sets).filter(\.completed).count
        guard total > 0 else { return 0 }
        return Int((Double(completed) / Double(total) * 100).rounded())
    }

    private func scheduleAutosave(onAutosave: @escaping (Workout) async -> Void) {
        autosaveTask?.cancel()
        let snapshot = workout
        autosaveTask = Task {
            try? await Task.sleep(for: .milliseconds(650))
            guard !Task.isCancelled, !snapshot.exercises.isEmpty else { return }
            await onAutosave(snapshot)
        }
    }

    private func recalculateTime() {
        if let start = workout.startTimestamp {
            let extra = (Date().timeIntervalSince1970 * 1000 - start) / 1000
            currentTime = workout.elapsedSeconds + extra
        } else {
            currentTime = workout.elapsedSeconds
        }
    }

    private func startTimerIfNeeded() {
        timerTask?.cancel()
        guard workout.startTimestamp != nil, !workout.completed else {
            return
        }

        timerTask = Task {
            while !Task.isCancelled {
                recalculateTime()
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }

    private func normalizeExerciseOrder() {
        workout.exercises = workout.exercises.enumerated().map { index, exercise in
            var updated = exercise
            updated.sortOrder = index
            return updated
        }
    }
}
