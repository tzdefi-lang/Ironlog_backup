import Foundation
import UserNotifications

@MainActor
final class NotificationService {
    func requestAuthorization() async -> Bool {
        do {
            return try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
        } catch {
            AppLogger.notification.error("Notification authorization failed: \((error as NSError).localizedDescription, privacy: .public)")
            return false
        }
    }

    @discardableResult
    func schedulePendingWorkoutReminder(identifier: String, title: String, body: String, at date: Date) async -> Bool {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let triggerDate = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        let trigger = UNCalendarNotificationTrigger(dateMatching: triggerDate, repeats: false)
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

        do {
            try await UNUserNotificationCenter.current().add(request)
            return true
        } catch {
            AppLogger.notification.error("Failed to schedule reminder \(identifier, privacy: .public): \((error as NSError).localizedDescription, privacy: .public)")
            return false
        }
    }
}
