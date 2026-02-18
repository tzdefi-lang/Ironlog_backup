import SwiftUI

struct StatsView: View {
    @Environment(AppStore.self) private var store
    @State private var viewModel = StatsViewModel()

    private var completed: [Workout] {
        store.workouts.filter(\.completed).sorted { $0.date < $1.date }
    }

    private var weeklyVolumes: [(weekStart: Date, volume: Double)] {
        StatsService.weeklyVolumes(workouts: completed)
    }

    private var weeklyChartData: [(label: String, volume: Double)] {
        let formatter = DateFormatter()
        formatter.dateFormat = "M/d"
        return weeklyVolumes.map { (formatter.string(from: $0.weekStart), $0.volume) }
    }

    private var weeklyFreqData: [(label: String, count: Int)] {
        let formatter = DateFormatter()
        formatter.dateFormat = "M/d"
        return StatsService.weeklyWorkoutCounts(workouts: completed).map {
            (formatter.string(from: $0.weekStart), $0.count)
        }
    }

    private var loadInsight: LoadInsight {
        StatsService.loadInsight(weeklyVolumes: weeklyVolumes.map(\.volume))
    }

    private var loadTrendPoints: [(label: String, volume: Double, baseline: Double, isCurrent: Bool)] {
        StatsService.loadTrendPoints(weeklyVolumes: weeklyVolumes)
    }

    private var selectedExerciseId: String? {
        viewModel.selectedExerciseID ?? selectableExercises.first?.id
    }

    private var selectableExercises: [ExerciseDef] {
        let ids = Set(completed.flatMap { $0.exercises.map(\.defId) })
        return store.exerciseDefs.filter { ids.contains($0.id) }
    }

    private var oneRMTrend: [(label: String, oneRM: Double)] {
        guard let id = selectedExerciseId else { return [] }
        return completed.compactMap { workout in
            let sets = workout.exercises.filter { $0.defId == id }.flatMap(\.sets).filter(\.completed)
            guard !sets.isEmpty else { return nil }
            let best = sets.reduce(0.0) { max($0, $1.weight * (1 + Double($1.reps) / 30)) }
            return (label: workout.date, oneRM: best)
        }
    }

    private var bodyPartDist: [(category: String, value: Double)] {
        var counts: [String: Double] = [:]
        let defById = Dictionary(uniqueKeysWithValues: store.exerciseDefs.map { ($0.id, $0) })
        for workout in completed {
            for exercise in workout.exercises {
                let cat = defById[exercise.defId]?.category ?? "Other"
                counts[cat, default: 0] += 1
            }
        }
        return counts
            .sorted { $0.value > $1.value }
            .map { (category: $0.key, value: $0.value) }
    }

    private var durationData: [(label: String, date: String, minutes: Int)] {
        StatsService.workoutDurations(workouts: completed).enumerated().map { idx, item in
            (label: "\(idx + 1)", date: item.date, minutes: item.minutes)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Stats")
                    .font(.display(40))

                if completed.isEmpty {
                    emptyState
                } else {
                    LoadRiskView(insight: loadInsight, trendPoints: loadTrendPoints)

                    WeeklyFrequencyChart(points: weeklyFreqData)

                    VStack(alignment: .leading, spacing: 12) {
                        Text("WEEKLY VOLUME")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Color.botanicalTextSecondary)
                            .tracking(1.2)
                        WeeklyVolumeChart(points: weeklyChartData)
                    }
                    .padding(16)
                    .botanicalCard()

                    if !selectableExercises.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("1RM TREND")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(Color.botanicalTextSecondary)
                                    .tracking(1.2)
                                Spacer()
                                Menu {
                                    ForEach(selectableExercises) { def in
                                        Button(def.name) { viewModel.selectedExerciseID = def.id }
                                    }
                                } label: {
                                    HStack(spacing: 4) {
                                        Text(selectableExercises.first(where: { $0.id == selectedExerciseId })?.name ?? "Select")
                                            .font(.botanicalSemibold(13))
                                            .lineLimit(1)
                                        Image(systemName: "chevron.down")
                                            .font(.system(size: 11))
                                    }
                                    .foregroundStyle(Color.botanicalAccent)
                                }
                            }

                            if oneRMTrend.isEmpty {
                                Text("No completed sets for this exercise")
                                    .font(.botanicalBody(13))
                                    .foregroundStyle(Color.botanicalTextSecondary)
                                    .padding(.vertical, 20)
                            } else {
                                OneRMTrendChart(points: oneRMTrend)
                            }
                        }
                        .padding(16)
                        .botanicalCard()
                    }

                    WorkoutDurationChart(points: durationData)

                    if !bodyPartDist.isEmpty {
                        BodyPartPieChart(values: bodyPartDist)
                    }
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 20)
            .padding(.bottom, 120)
        }
        .background(Color.botanicalBackground.ignoresSafeArea())
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "chart.bar.xaxis")
                .font(.system(size: 40))
                .foregroundStyle(Color.botanicalMuted)
            Text("Complete workouts to see your stats")
                .font(.botanicalBody(15))
                .foregroundStyle(Color.botanicalTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
        .botanicalCard()
    }
}
