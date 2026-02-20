import UIKit

@MainActor
final class HapticManager {
    static let shared = HapticManager()

    private init() {}

    func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }

    func light() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    func medium() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    func rigid() {
        UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
    }

    func warning() {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
    }

    func error() {
        UINotificationFeedbackGenerator().notificationOccurred(.error)
    }

    func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}
