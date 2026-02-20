import SwiftUI
import UIKit
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = NotificationDelegate.shared
        prewarmKeyboard()
        return true
    }

    /// Pre-loads the keyboard text-input frameworks on a background thread
    /// so the first tap on a text field doesn't stall the UI.
    /// We intentionally do NOT call becomeFirstResponder here to avoid
    /// the keyboard flashing on screen during the session restore splash.
    private func prewarmKeyboard() {
        DispatchQueue.global(qos: .userInitiated).async {
            // Touching activeInputModes forces iOS to load the TextInput
            // bundle and associated frameworks without showing the keyboard.
            let _ = UITextInputMode.activeInputModes
            // Allocating a UITextField (off-screen, never added to a window)
            // warms additional internal caches.
            let _ = UITextField(frame: .zero)
        }
    }
}

final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationDelegate()

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}
