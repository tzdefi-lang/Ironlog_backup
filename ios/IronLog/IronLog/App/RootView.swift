import SwiftUI

struct RootView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.colorScheme) private var systemScheme

    var body: some View {
        Group {
            if store.user == nil {
                LoginView()
            } else {
                MainTabView()
            }
        }
        .background(Color.botanicalBackground.ignoresSafeArea())
        .preferredColorScheme(preferredScheme)
    }

    private var preferredScheme: ColorScheme? {
        guard let mode = store.user?.preferences.themeMode else { return nil }
        switch mode {
        case .light:
            return .light
        case .dark:
            return .dark
        case .system:
            return nil
        }
    }
}
