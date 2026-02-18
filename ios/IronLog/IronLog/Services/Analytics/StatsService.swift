import Foundation

enum LoadRiskLevel: String, Sendable {
    case insufficient
    case low
    case normal
    case elevated
    case high
}

struct LoadInsight: Sendable {
    var level: LoadRiskLevel
    var acuteVolume: Double
    var baselineVolume: Double
    var ratio: Double?
}

enum StatsService {
    static func totalVolume(for workout: Workout) -> Double {
        workout.exercises
            .flatMap(\.sets)
            .filter(\.completed)
            .reduce(0) { $0 + $1.weight * Double($1.reps) }
    }

    static func weeklyVolumes(workouts: [Workout], weeks: Int = 12, from today: Date = Date()) -> [(weekStart: Date, volume: Double)] {
        let calendar = Calendar(identifier: .gregorian)
        let monday = weekStart(for: today)

        var buckets: [(Date, Double)] = []
        for offset in stride(from: weeks - 1, through: 0, by: -1) {
            if let start = calendar.date(byAdding: .day, value: -offset * 7, to: monday) {
                buckets.append((start, 0))
            }
        }

        for workout in workouts where workout.completed {
            guard let date = parseLocalDate(workout.date) else { continue }
            let key = weekStart(for: date)
            if let idx = buckets.firstIndex(where: { calendar.isDate($0.0, inSameDayAs: key) }) {
                buckets[idx].1 += totalVolume(for: workout)
            }
        }

        return buckets.map { (weekStart: $0.0, volume: $0.1) }
    }

    static func weeklyWorkoutCounts(workouts: [Workout], weeks: Int = 12, from today: Date = Date()) -> [(weekStart: Date, count: Int)] {
        let monday = weekStart(for: today)
        var buckets: [(Date, Int)] = []

        for offset in stride(from: weeks - 1, through: 0, by: -1) {
            if let start = Calendar.current.date(byAdding: .day, value: -offset * 7, to: monday) {
                buckets.append((start, 0))
            }
        }

        for workout in workouts where workout.completed {
            guard let date = parseLocalDate(workout.date) else { continue }
            let key = weekStart(for: date)
            if let idx = buckets.firstIndex(where: { Calendar.current.isDate($0.0, inSameDayAs: key) }) {
                buckets[idx].1 += 1
            }
        }

        return buckets.map { (weekStart: $0.0, count: $0.1) }
    }

    static func workoutDurations(workouts: [Workout], limit: Int = 16) -> [(date: String, minutes: Int)] {
        workouts
            .filter { $0.completed && $0.elapsedSeconds > 0 }
            .sorted { $0.date < $1.date }
            .suffix(limit)
            .map { workout in
                let mins = max(0, Int(workout.elapsedSeconds / 60))
                return (date: String(workout.date.suffix(5)), minutes: mins)
            }
    }

    static func loadTrendPoints(weeklyVolumes vols: [(weekStart: Date, volume: Double)]) -> [(label: String, volume: Double, baseline: Double, isCurrent: Bool)] {
        let formatter = DateFormatter()
        formatter.dateFormat = "M/d"

        let recent = Array(vols.suffix(8))
        return recent.enumerated().map { idx, point in
            let baselineWindow = recent[max(0, idx - 4) ..< idx].map(\.volume)
            let baseline = baselineWindow.isEmpty ? 0 : baselineWindow.reduce(0, +) / Double(baselineWindow.count)

            return (
                label: formatter.string(from: point.weekStart),
                volume: point.volume,
                baseline: baseline,
                isCurrent: idx == recent.count - 1
            )
        }
    }

    static func loadInsight(weeklyVolumes: [Double], guardrails: LoadGuardrails = .webParity) -> LoadInsight {
        guard !weeklyVolumes.isEmpty else {
            return LoadInsight(level: .insufficient, acuteVolume: 0, baselineVolume: 0, ratio: nil)
        }

        let acute = weeklyVolumes.last ?? 0
        let baselineWindow = Array(weeklyVolumes.dropLast().suffix(4))
        let baseline = baselineWindow.isEmpty ? 0 : baselineWindow.reduce(0, +) / Double(baselineWindow.count)
        let ratio = baseline > 0 ? acute / baseline : nil
        let absoluteIncrease = acute - baseline
        let weeksWithVolume = baselineWindow.filter { $0 > 0 }.count
        let hasEnoughBaseline = weeksWithVolume >= 2 && baseline > 0

        let level: LoadRiskLevel
        if !hasEnoughBaseline {
            level = .insufficient
        } else if baseline >= guardrails.minBaselineVolume,
                  absoluteIncrease >= guardrails.minAbsoluteIncrease,
                  let ratio,
                  ratio >= guardrails.highRatio {
            level = .high
        } else if baseline >= guardrails.minBaselineVolume,
                  absoluteIncrease >= guardrails.minAbsoluteIncrease,
                  let ratio,
                  ratio >= guardrails.elevatedRatio {
            level = .elevated
        } else if baseline >= guardrails.minBaselineVolume,
                  let ratio,
                  ratio <= guardrails.lowRatio {
            level = .low
        } else {
            level = .normal
        }

        return LoadInsight(level: level, acuteVolume: acute, baselineVolume: baseline, ratio: ratio)
    }

    static func parseLocalDate(_ value: String) -> Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        return formatter.date(from: value)
    }

    static func weekStart(for date: Date) -> Date {
        let calendar = Calendar(identifier: .gregorian)
        let day = calendar.component(.weekday, from: date)
        let diff = day == 1 ? -6 : 2 - day
        return calendar.date(byAdding: .day, value: diff, to: calendar.startOfDay(for: date)) ?? date
    }
}
