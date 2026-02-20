import Foundation
import UIKit

enum ExportServiceError: LocalizedError {
    case encodingFailed
    case fileWriteFailed(String)
    case invalidCSVData

    var errorDescription: String? {
        switch self {
        case .encodingFailed:
            return "Could not encode export data."
        case .fileWriteFailed(let details):
            return "Could not write export file: \(details)"
        case .invalidCSVData:
            return "Could not build CSV export data."
        }
    }
}

@MainActor
final class ExportService {
    func exportJSON(workouts: [Workout], exerciseDefs: [ExerciseDef], from viewController: UIViewController) {
        struct Payload: Encodable {
            let exportedAt: String
            let workouts: [Workout]
            let exerciseDefs: [ExerciseDef]
        }

        let payload = Payload(
            exportedAt: ISO8601DateFormatter().string(from: Date()),
            workouts: workouts,
            exerciseDefs: exerciseDefs
        )

        do {
            let data = try JSONEncoder().encode(payload)
            let url = temporaryURL(name: "ironlog-export-\(timestamp()).json")
            do {
                try data.write(to: url)
                present(url: url, from: viewController)
            } catch {
                throw ExportServiceError.fileWriteFailed((error as NSError).localizedDescription)
            }
        } catch {
            let exportError = (error as? ExportServiceError) ?? ExportServiceError.encodingFailed
            handleExportError(exportError, from: viewController)
        }
    }

    func exportCSV(workouts: [Workout], exerciseDefs: [ExerciseDef], from viewController: UIViewController) {
        let names = Dictionary(uniqueKeysWithValues: exerciseDefs.map { ($0.id, $0.name) })
        var lines = ["date,workout_title,workout_note,exercise_name,set_index,weight,reps,completed"]

        for workout in workouts {
            for exercise in workout.exercises {
                let name = names[exercise.defId] ?? "Unknown Exercise"
                for (index, set) in exercise.sets.enumerated() {
                    lines.append([
                        workout.date,
                        workout.title,
                        workout.note,
                        name,
                        String(index + 1),
                        String(set.weight),
                        String(set.reps),
                        String(set.completed)
                    ].map(csvEscape).joined(separator: ","))
                }
            }
        }

        let text = lines.joined(separator: "\n")
        let url = temporaryURL(name: "ironlog-export-\(timestamp()).csv")

        do {
            guard let data = text.data(using: .utf8) else {
                throw ExportServiceError.invalidCSVData
            }
            do {
                try data.write(to: url)
                present(url: url, from: viewController)
            } catch {
                throw ExportServiceError.fileWriteFailed((error as NSError).localizedDescription)
            }
        } catch {
            handleExportError(error, from: viewController)
        }
    }

    private func present(url: URL, from viewController: UIViewController) {
        let activity = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        viewController.present(activity, animated: true)
    }

    private func csvEscape(_ value: String) -> String {
        if value.contains(",") || value.contains("\"") || value.contains("\n") {
            return "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
        }
        return value
    }

    private func temporaryURL(name: String) -> URL {
        FileManager.default.temporaryDirectory.appending(path: name)
    }

    private func timestamp() -> String {
        ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "-")
    }

    private func handleExportError(_ error: Error, from viewController: UIViewController) {
        let message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        AppLogger.export.error("Export failed: \(message, privacy: .public)")

        let alert = UIAlertController(title: "Export Failed", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        if viewController.presentedViewController == nil {
            viewController.present(alert, animated: true)
        }
    }
}
