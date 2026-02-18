import SwiftData
import SwiftUI
import UIKit

@main
struct IronLogApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    private let modelContainer: ModelContainer
    @State private var store: AppStore

    init() {
        Self.configureNavigationBarAppearance()

        let schema = Schema([
            WorkoutModel.self,
            ExerciseInstanceModel.self,
            WorkoutSetModel.self,
            ExerciseDefModel.self,
            WorkoutTemplateModel.self,
            SyncQueueItemModel.self,
        ])

        let config = ModelConfiguration(isStoredInMemoryOnly: false, cloudKitDatabase: .none)
        let container = try! ModelContainer(for: schema, configurations: [config])
        modelContainer = container
        _store = State(initialValue: AppStore(modelContext: container.mainContext))
    }

    private static func configureNavigationBarAppearance() {
        let titleAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont(name: "SourceSans3-SemiBold", size: 17) ?? UIFont.systemFont(ofSize: 17, weight: .semibold),
            .foregroundColor: UIColor { traitCollection in
                traitCollection.userInterfaceStyle == .dark
                    ? UIColor(red: 0.965, green: 0.953, blue: 0.929, alpha: 1)
                    : UIColor(red: 0.176, green: 0.227, blue: 0.192, alpha: 1)
            },
        ]

        let largeTitleAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont(name: "PlayfairDisplay-SemiBold", size: 34) ?? UIFont.systemFont(ofSize: 34, weight: .bold),
            .foregroundColor: UIColor { traitCollection in
                traitCollection.userInterfaceStyle == .dark
                    ? UIColor(red: 0.965, green: 0.953, blue: 0.929, alpha: 1)
                    : UIColor(red: 0.176, green: 0.227, blue: 0.192, alpha: 1)
            },
        ]

        let appearance = UINavigationBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.backgroundColor = UIColor(Color.botanicalBackground)
        appearance.titleTextAttributes = titleAttributes
        appearance.largeTitleTextAttributes = largeTitleAttributes
        appearance.shadowColor = .clear

        UINavigationBar.appearance().standardAppearance = appearance
        UINavigationBar.appearance().scrollEdgeAppearance = appearance
        UINavigationBar.appearance().compactAppearance = appearance
        UINavigationBar.appearance().tintColor = UIColor(red: 0.549, green: 0.604, blue: 0.518, alpha: 1)

        UIBarButtonItem.appearance().setTitleTextAttributes([
            .font: UIFont(name: "SourceSans3-SemiBold", size: 16) ?? UIFont.systemFont(ofSize: 16, weight: .semibold),
        ], for: .normal)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .modelContainer(modelContainer)
                .task {
                    await store.attemptSessionRestore()
                }
                .onOpenURL { url in
                    guard WalletSIWEService.shared.isConfigured else { return }
                    _ = WalletSIWEService.shared.handleOpenURL(url)
                }
        }
    }
}
