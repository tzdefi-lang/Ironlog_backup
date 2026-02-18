import SwiftUI

struct RootView: View {
    @Environment(AppStore.self) private var store
    @AppStorage("ironlog_language") private var languageCode = Locale.current.language.languageCode?.identifier ?? "en"

    var body: some View {
        Group {
            if store.isBootstrappingSession {
                bootstrappingView
            } else if store.user == nil {
                LoginView()
            } else {
                MainTabView()
            }
        }
        .background(Color.botanicalBackground.ignoresSafeArea())
        .preferredColorScheme(preferredScheme)
        .environment(\.locale, Locale(identifier: normalizedLanguageCode))
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

    private var normalizedLanguageCode: String {
        let normalized = languageCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return "en" }
        let lowered = normalized.lowercased()
        if lowered == "zh" || lowered.hasPrefix("zh-") {
            return "zh-Hans"
        }
        return normalized
    }

    private var bootstrappingView: some View {
        VStack(spacing: 14) {
            ProgressView()
                .tint(Color.botanicalAccent)
                .scaleEffect(1.1)
            Text("auth.login.restoreSession")
                .font(.botanicalBody(14))
                .foregroundStyle(Color.botanicalTextSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
