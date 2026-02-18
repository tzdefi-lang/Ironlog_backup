import Foundation

enum PRMetric: String, Sendable {
    case maxWeight
    case maxVolume
    case estimated1RM
}

struct ExercisePR: Sendable, Equatable {
    var maxWeight: Double
    var maxVolume: Double
    var maxEstimated1RM: Double

    static let zero = ExercisePR(maxWeight: 0, maxVolume: 0, maxEstimated1RM: 0)
}

struct PRBreak: Sendable, Identifiable {
    var id: String { "\(exerciseDefId)-\(metric.rawValue)" }
    var exerciseDefId: String
    var exerciseName: String
    var metric: PRMetric
    var previous: Double
    var current: Double
}

enum PRService {
    static func calculatePRs(workouts: [Workout]) -> [String: ExercisePR] {
        var prs: [String: ExercisePR] = [:]

        for workout in workouts {
            var workoutVolumeByDef: [String: Double] = [:]
            for exercise in workout.exercises {
                var pr = prs[exercise.defId] ?? .zero
                var volume: Double = 0
                for set in exercise.sets where set.completed {
                    let oneRM = set.weight * (1 + Double(set.reps) / 30)
                    pr.maxWeight = max(pr.maxWeight, set.weight)
                    pr.maxEstimated1RM = max(pr.maxEstimated1RM, oneRM)
                    volume += set.weight * Double(set.reps)
                }
                prs[exercise.defId] = pr
                workoutVolumeByDef[exercise.defId, default: 0] += volume
            }

            for (defId, volume) in workoutVolumeByDef {
                var pr = prs[defId] ?? .zero
                pr.maxVolume = max(pr.maxVolume, volume)
                prs[defId] = pr
            }
        }

        return prs
    }

    static func calculateBrokenPRs(workout: Workout, historical: [String: ExercisePR], exerciseDefs: [ExerciseDef]) -> [PRBreak] {
        let names = Dictionary(uniqueKeysWithValues: exerciseDefs.map { ($0.id, $0.name) })
        var currentStats: [String: ExercisePR] = [:]

        for exercise in workout.exercises {
            var stat = currentStats[exercise.defId] ?? .zero
            for set in exercise.sets where set.completed {
                let oneRM = set.weight * (1 + Double(set.reps) / 30)
                stat.maxWeight = max(stat.maxWeight, set.weight)
                stat.maxEstimated1RM = max(stat.maxEstimated1RM, oneRM)
                stat.maxVolume += set.weight * Double(set.reps)
            }
            currentStats[exercise.defId] = stat
        }

        var breaks: [PRBreak] = []
        for (defId, current) in currentStats {
            let base = historical[defId] ?? .zero
            let name = names[defId] ?? "Unknown Exercise"

            if current.maxWeight > base.maxWeight {
                breaks.append(PRBreak(exerciseDefId: defId, exerciseName: name, metric: .maxWeight, previous: base.maxWeight, current: current.maxWeight))
            }
            if current.maxVolume > base.maxVolume {
                breaks.append(PRBreak(exerciseDefId: defId, exerciseName: name, metric: .maxVolume, previous: base.maxVolume, current: current.maxVolume))
            }
            if current.maxEstimated1RM > base.maxEstimated1RM {
                breaks.append(PRBreak(exerciseDefId: defId, exerciseName: name, metric: .estimated1RM, previous: base.maxEstimated1RM, current: current.maxEstimated1RM))
            }
        }
        return breaks
    }
}
