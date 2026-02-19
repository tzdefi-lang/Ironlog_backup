# CODEX-DEV-TASKS-V3

Four targeted fixes identified after the second Codex pass. Each section contains the exact file paths, the problem, and a precise implementation spec.

---

## Problem 1 — Danger button color is too vivid

**File:** `ios/IronLog/IronLog/Views/Shared/BotanicalButton.swift`

### Current state
```swift
private var background: Color {
    switch variant {
    case .primary:   return .botanicalAccent
    case .secondary: return .botanicalMuted
    case .danger:    return .red          // ← iOS system red, too vivid
    }
}
private var foreground: Color {
    switch variant {
    case .primary:   return .botanicalTextPrimary
    case .secondary: return .botanicalTextSecondary
    case .danger:    return .white
    }
}
```

### Fix
Replace the `.danger` background and foreground so they blend with the muted Botanical palette.
Use a desaturated terracotta/rose that reads as "destructive" without clashing with the sage-green accent.

```swift
private var background: Color {
    switch variant {
    case .primary:   return .botanicalAccent
    case .secondary: return .botanicalMuted
    case .danger:    return Color(red: 0.72, green: 0.32, blue: 0.28).opacity(0.85)
    }
}
private var foreground: Color {
    switch variant {
    case .primary:   return .botanicalTextPrimary
    case .secondary: return .botanicalTextSecondary
    case .danger:    return Color(red: 0.98, green: 0.93, blue: 0.91)
    }
}
```

The background `(0.72, 0.32, 0.28)` is a warm earth-red (#B85248) at 85% opacity.
The foreground is a warm off-white that matches the Botanical light-mode parchment tint.
No other files need changing — every `.danger` button in the app (Sign Out, Delete) inherits this automatically.

---

## Problem 2 — Language switching saves preference but never changes app language

**Files:**
- `ios/IronLog/IronLog/Views/Profile/ProfileSettingsView.swift` (languageChip action)
- New file: `ios/IronLog/IronLog/Utilities/LanguageManager.swift`
- New files: `ios/IronLog/IronLog/Resources/en.lproj/Localizable.strings`
- New files: `ios/IronLog/IronLog/Resources/zh-Hans.lproj/Localizable.strings`

### Current state
`languageChip` writes to `@AppStorage("ironlog_language")` but nothing reads that value to change the displayed language. All strings are hardcoded in English.

### Fix — Step 1: Create a LanguageManager

Create `ios/IronLog/IronLog/Utilities/LanguageManager.swift`:

```swift
import Foundation

final class LanguageManager: ObservableObject {
    static let shared = LanguageManager()

    private let key = "ironlog_language"

    private(set) var currentLanguage: String {
        didSet {
            UserDefaults.standard.set([currentLanguage], forKey: "AppleLanguages")
            UserDefaults.standard.set(currentLanguage, forKey: key)
            updateBundle()
        }
    }

    // The bundle to use for localized strings
    private(set) var bundle: Bundle = .main

    private init() {
        let saved = UserDefaults.standard.string(forKey: key)
            ?? Locale.current.language.languageCode?.identifier
            ?? "en"
        currentLanguage = saved
        updateBundle()
    }

    func setLanguage(_ code: String) {
        guard code != currentLanguage else { return }
        currentLanguage = code
        // Notify all listeners that the language changed
        NotificationCenter.default.post(name: .languageDidChange, object: code)
    }

    private func updateBundle() {
        // Find the .lproj bundle for the requested language
        if let path = Bundle.main.path(forResource: currentLanguage, ofType: "lproj"),
           let langBundle = Bundle(path: path) {
            bundle = langBundle
        } else {
            // Fallback to English
            if let path = Bundle.main.path(forResource: "en", ofType: "lproj"),
               let fallback = Bundle(path: path) {
                bundle = fallback
            } else {
                bundle = .main
            }
        }
    }
}

extension Notification.Name {
    static let languageDidChange = Notification.Name("ironlog.languageDidChange")
}

// Convenience global function used like NSLocalizedString
func L(_ key: String, comment: String = "") -> String {
    LanguageManager.shared.bundle.localizedString(forKey: key, value: nil, table: nil)
}
```

### Fix — Step 2: Create localization string files

Create `ios/IronLog/IronLog/Resources/en.lproj/Localizable.strings`:
```
/* Settings */
"settings.unit" = "Unit";
"settings.theme" = "Theme";
"settings.language" = "Language";
"settings.notifications" = "Notifications";
"settings.notifications.reminders" = "Workout reminders";
"settings.export" = "Export Data";
"settings.export.json" = "Export as JSON";
"settings.export.csv" = "Export as CSV";
"settings.account" = "Account";
"settings.account.signout" = "Sign Out";
"settings.theme.light" = "Light";
"settings.theme.dark" = "Dark";
"settings.theme.auto" = "Auto";
"settings.language.english" = "English";
"settings.language.chinese" = "Chinese";
```

Create `ios/IronLog/IronLog/Resources/zh-Hans.lproj/Localizable.strings`:
```
/* Settings */
"settings.unit" = "单位";
"settings.theme" = "主题";
"settings.language" = "语言";
"settings.notifications" = "通知";
"settings.notifications.reminders" = "训练提醒";
"settings.export" = "导出数据";
"settings.export.json" = "导出为 JSON";
"settings.export.csv" = "导出为 CSV";
"settings.account" = "账户";
"settings.account.signout" = "退出登录";
"settings.theme.light" = "浅色";
"settings.theme.dark" = "深色";
"settings.theme.auto" = "跟随系统";
"settings.language.english" = "English";
"settings.language.chinese" = "中文";
```

### Fix — Step 3: Wire ProfileSettingsView to LanguageManager

In `ProfileSettingsView.swift`:

1. Remove the `@AppStorage("ironlog_language")` property.
2. Add `@State private var language = LanguageManager.shared.currentLanguage`.
3. Add `.onReceive(NotificationCenter.default.publisher(for: .languageDidChange)) { note in language = note.object as? String ?? language }` to the `ScrollView`.
4. Update `languageChip` action to call `LanguageManager.shared.setLanguage(code)` instead of `language = code`.
5. Replace hardcoded `settingCard` title strings with `L("settings.unit")`, `L("settings.theme")`, etc.
6. Replace `languageChip("English", code: "en")` → `languageChip(L("settings.language.english"), code: "en")`.
7. Replace `languageChip("中文", code: "zh-Hans")` → `languageChip(L("settings.language.chinese"), code: "zh-Hans")`.

Updated `languageChip` action:
```swift
private func languageChip(_ label: String, code: String) -> some View {
    let selected = language == code
    return Button {
        LanguageManager.shared.setLanguage(code)
    } label: {
        Text(label)
            .font(.botanicalSemibold(13))
            .foregroundStyle(selected ? Color.botanicalTextPrimary : Color.botanicalTextSecondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(selected ? Color.botanicalAccent : Color.botanicalMuted.opacity(0.6))
            .clipShape(Capsule())
    }
    .buttonStyle(PressableButtonStyle())
    .animation(.easeOut(duration: 0.2), value: selected)
}
```

**Note:** iOS does not allow fully seamless runtime language switching without a restart for system-provided strings (navigation bar back button, system alerts, etc.). After calling `LanguageManager.shared.setLanguage`, UI text managed by the `L()` helper will update immediately. System-level UI requires re-launch. If immediate full-app reload is desired, add a brief `withAnimation` that sets a `@State var languageRefreshID = UUID()` on the root view and use `.id(languageRefreshID)` on `MainTabView` to force SwiftUI to rebuild the entire view tree.

---

## Problem 3 — Rest Timer section in Settings is redundant

**File:** `ios/IronLog/IronLog/Views/Profile/ProfileSettingsView.swift`

### Current state
Lines 27–36 contain a "Rest Timer" settingCard with chips for 30/60/90/120/180s. The same setting is already accessible inside the active workout via `RestTimerView`. Having it in Settings is confusing.

### Fix
Delete the entire block:

```swift
// DELETE this entire block (lines 27–36):
settingCard(title: "Rest Timer") {
    HStack(spacing: 8) {
        ForEach([30, 60, 90, 120, 180], id: \.self) { sec in
            timerChip("\(sec)s", selected: prefs.restTimerSeconds == sec) {
                store.setRestTimerSeconds(sec)
            }
        }
        Spacer()
    }
}
```

Also delete the `timerChip` private helper function (lines 120–132) since it will no longer be used anywhere.

No other files need changes.

---

## Problem 4 — App requires re-login after being killed from background

**Files:**
- `ios/IronLog/IronLog/Services/Auth/TokenExchangeService.swift`
- `ios/IronLog/IronLog/Store/AppStore.swift`
- `ios/IronLog/IronLog/App/IronLogApp.swift`

### Root cause
`TokenExchangeService.exchange()` already saves the JWT to Keychain (`ironlog_supabase_jwt`) and the userId (`ironlog_user_id`). However:
1. `expiresAt` is **not** saved to Keychain, so there is no way to validate the token's expiry on restore without a network call.
2. `AppStore.init()` never attempts to restore from Keychain — it sets `isLoading = false` immediately.
3. `RootView` shows `LoginView` whenever `store.user == nil`, which is always true on cold launch.

### Fix — Step 1: Save expiresAt to Keychain in TokenExchangeService

In `TokenExchangeService.exchange()`, after the existing `keychain.set` calls, add:

```swift
// Existing saves:
keychain.set(result.token, forKey: "ironlog_supabase_jwt")
keychain.set(result.userId, forKey: "ironlog_user_id")
// NEW: persist expiry for restore validation
keychain.set(String(result.expiresAt), forKey: "ironlog_jwt_expires_at")
```

In `TokenExchangeService.clear()`, add:

```swift
keychain.delete("ironlog_jwt_expires_at")
```

### Fix — Step 2: Add restoreSession() to TokenExchangeService

Add this method to `TokenExchangeService`:

```swift
/// Returns a cached TokenExchangeResult from Keychain if the stored JWT
/// is still valid (more than 5 minutes of lifetime remaining).
/// Returns nil if no stored token exists or if it is expired.
func restoreSession() -> TokenExchangeResult? {
    guard
        let token = keychain.get("ironlog_supabase_jwt"),
        let userId = keychain.get("ironlog_user_id"),
        let expiresAtStr = keychain.get("ironlog_jwt_expires_at"),
        let expiresAt = Double(expiresAtStr)
    else {
        return nil
    }

    let nowMs = Date().timeIntervalSince1970 * 1000
    // Require at least 5 minutes of validity remaining
    guard nowMs < expiresAt - 5 * 60 * 1000 else {
        // Token is expired or about to expire — clear stale data
        clear()
        return nil
    }

    return TokenExchangeResult(token: token, userId: userId, expiresAt: expiresAt)
}
```

### Fix — Step 3: Add attemptSessionRestore() to AppStore

In `AppStore.swift`, add this method. It must be called **before** `isLoading = false` in init, or immediately after app launch via `task`:

```swift
/// Attempts to restore a previous session from Keychain.
/// Called once on cold launch. If successful, the user is logged in
/// without any network round-trip to Privy.
func attemptSessionRestore() async {
    guard user == nil else { return }

    guard let cached = tokenExchangeService.restoreSession() else {
        // No valid session in Keychain; show login screen
        isLoading = false
        return
    }

    isLoading = true
    SupabaseClientProvider.shared.setAuthToken(cached.token)
    // Build a minimal UserProfile from the JWT userId so the app
    // considers the user logged in while data loads in the background.
    mapPrivyUser(userId: cached.userId, profile: nil)
    await refreshData()
    isLoading = false
}
```

Also update `AppStore.init()` — remove the `isLoading = false` line at the end of `init` so that `isLoading` stays `true` (showing a loading indicator) until `attemptSessionRestore()` completes:

```swift
init(...) {
    // ... existing setup ...
    registerReconnectObserver()
    restoreThemeFromGlobal()
    // REMOVE: isLoading = false   ← delete this line
    // isLoading stays true; it will be set false by attemptSessionRestore()
}
```

### Fix — Step 4: Call attemptSessionRestore from IronLogApp

In `IronLogApp.swift`, update `body` to trigger session restore on launch using `.task`:

```swift
var body: some Scene {
    WindowGroup {
        RootView()
            .environment(store)
            .modelContainer(modelContainer)
            .task {
                await store.attemptSessionRestore()
            }
    }
}
```

### Fix — Step 5: Show a loading screen in RootView during restore

In `RootView.swift`, update `body` to show a neutral loading view while `store.isLoading` is `true` (which happens during session restore):

```swift
var body: some View {
    Group {
        if store.isLoading {
            // Splash / loading indicator shown during session restore
            ZStack {
                Color.botanicalBackground.ignoresSafeArea()
                VStack(spacing: 16) {
                    Text("IronLog")
                        .font(.display(40))
                        .foregroundStyle(Color.botanicalTextPrimary)
                    ProgressView()
                        .tint(Color.botanicalAccent)
                }
            }
        } else if store.user == nil {
            LoginView()
        } else {
            MainTabView()
        }
    }
    .background(Color.botanicalBackground.ignoresSafeArea())
    .preferredColorScheme(preferredScheme)
}
```

This guarantees the user never sees a login screen flash before the Keychain restore completes.

---

## Summary of files changed

| File | Change |
|------|--------|
| `Views/Shared/BotanicalButton.swift` | Mute danger color from `.red` to earth-red (#B85248) |
| `Utilities/LanguageManager.swift` | **New file** — runtime bundle-switching language manager |
| `Resources/en.lproj/Localizable.strings` | **New file** — English localization keys |
| `Resources/zh-Hans.lproj/Localizable.strings` | **New file** — Chinese localization keys |
| `Views/Profile/ProfileSettingsView.swift` | Remove Rest Timer card; wire language chips to LanguageManager |
| `Store/AppStore.swift` | Add `attemptSessionRestore()`, remove `isLoading = false` from init |
| `Services/Auth/TokenExchangeService.swift` | Save/restore/clear `expiresAt` in Keychain; add `restoreSession()` |
| `App/IronLogApp.swift` | Add `.task { await store.attemptSessionRestore() }` |
| `App/RootView.swift` | Add loading state branch before login/main check |
