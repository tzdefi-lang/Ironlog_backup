# IronLog iOS — Codex 开发任务文档 V2

> **基于当前实际代码状态**（已完成第一轮修复后）编写
> **本文档聚焦于仍未解决的 5 大问题领域**
> 所有路径相对于 `/ios/IronLog/IronLog/`

---

## 问题一：ExercisePickerSheet 内无法预览练习视频和说明

### 现状分析

`Views/WorkoutEditor/ExercisePickerSheet.swift`（当前 170 行）已实现：搜索框、分类胶囊、缩略图。

**缺失：** 每个练习行没有"查看详情"入口。用户无法在添加练习前看到视频示范和文字说明。`ExerciseDetailModal` 已完整实现，但只能从 `ExerciseCardView` 内（已添加到 workout 后）打开，选择阶段看不到。

### 修复方案

在 `ExercisePickerSheet` 的每个练习行 label 的右侧，将 `Image(systemName: "plus.circle.fill")` 改为两个独立控件：一个 ℹ️ 按钮，一个 ＋ 按钮，点击 ℹ️ 不选择练习、只展示详情。

**修改 `ExercisePickerSheet.swift`：**

```swift
// 1. 增加 sheet 状态
@State private var previewDef: ExerciseDef?

// 2. 将每行的 Button 改为 HStack，拆分"预览"和"添加"
ForEach(filtered) { def in
    HStack(spacing: 12) {
        // 缩略图（不变）
        thumbnail(for: def)

        // 文字信息（不变）
        VStack(alignment: .leading, spacing: 3) {
            Text(def.name)
                .font(.botanicalSemibold(15))
                .foregroundStyle(Color.botanicalTextPrimary)
                .multilineTextAlignment(.leading)

            HStack(spacing: 6) {
                Text(def.category)
                    .font(.caption)
                    .foregroundStyle(Color.botanicalTextSecondary)
                if def.source == .official {
                    Text("Official")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.botanicalTextPrimary)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color.botanicalAccent.opacity(0.35))
                        .clipShape(Capsule())
                }
            }
        }

        Spacer()

        // ℹ️ 预览按钮（新增）
        Button {
            previewDef = def
        } label: {
            Image(systemName: "info.circle")
                .font(.system(size: 20))
                .foregroundStyle(Color.botanicalTextSecondary)
        }
        .buttonStyle(.plain)

        // ＋ 添加按钮（原有）
        Button {
            onSelect(def)
            dismiss()
        } label: {
            Image(systemName: "plus.circle.fill")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Color.botanicalAccent)
        }
        .buttonStyle(.plain)
    }
    .contentShape(Rectangle())
    .padding(.vertical, 10)
    .contextMenu {
        if !def.readOnly {
            Button("Edit") { onEdit(def) }
            Button("Delete", role: .destructive) {
                Task { await onDelete(def) }
            }
        }
    }

    Divider().padding(.leading, 76)
}
// 3. 在 body 末尾添加 sheet
.sheet(item: $previewDef) { def in
    ExerciseDetailModal(exerciseDef: def, currentExercise: nil, workouts: [])
}
```

**注意：** `ExerciseDef` 需要 conform to `Identifiable`（检查 `Types.swift`，如已有 `var id: String` 则添加 `extension ExerciseDef: Identifiable {}`）。

### 验收标准
- 点击 ℹ️ 打开 ExerciseDetailModal（含视频和说明）
- 点击 ＋ 直接添加练习并关闭 sheet
- 不影响现有的 context menu（编辑/删除）

---

## 问题二：CalendarView 底部 Workout 卡片使用 iOS 原生按钮样式

### 现状分析

`Views/Calendar/DayWorkoutListView.swift`（当前 40 行）：

```swift
HStack(spacing: 8) {
    Button("Open") { onOpen(workout) }
    Button("Copy") { onCopy(workout) }
    Button("Delete", role: .destructive) { onDelete(workout) }
}
.buttonStyle(.borderless)  // ← iOS 系统蓝色文字链接样式
```

这是 iOS 原生的 `.borderless` 蓝色文字链接，与整个 app 的 Botanical 设计完全脱节。

### 修复方案

**完整替换 `DayWorkoutListView.swift`：**

```swift
import SwiftUI

struct DayWorkoutListView: View {
    let workouts: [Workout]
    let onOpen: (Workout) -> Void
    let onCopy: (Workout) -> Void
    let onDelete: (Workout) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if workouts.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "calendar.badge.plus")
                        .font(.system(size: 32))
                        .foregroundStyle(Color.botanicalMuted)
                    Text("No workouts on this day")
                        .font(.botanicalBody(14))
                        .foregroundStyle(Color.botanicalTextSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.vertical, 32)
            } else {
                ForEach(workouts) { workout in
                    BotanicalCard(elevated: true) {
                        VStack(alignment: .leading, spacing: 10) {

                            // 状态标签 + 标题行
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 4) {
                                    if !workout.completed && workout.startTimestamp != nil {
                                        HStack(spacing: 4) {
                                            Circle()
                                                .fill(Color.botanicalSuccess)
                                                .frame(width: 6, height: 6)
                                            Text("In Progress")
                                                .font(.system(size: 11, weight: .semibold))
                                                .foregroundStyle(Color.botanicalSuccess)
                                        }
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(Color.botanicalSuccess.opacity(0.12))
                                        .clipShape(Capsule())
                                    } else if workout.completed {
                                        Text("Completed")
                                            .font(.system(size: 11, weight: .semibold))
                                            .foregroundStyle(Color.botanicalAccent)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 3)
                                            .background(Color.botanicalAccent.opacity(0.12))
                                            .clipShape(Capsule())
                                    }

                                    Text(workout.title)
                                        .font(.botanicalSemibold(17))
                                        .foregroundStyle(Color.botanicalTextPrimary)
                                }

                                Spacer()

                                Text("\(workout.exercises.count) ex")
                                    .font(.botanicalBody(13))
                                    .foregroundStyle(Color.botanicalTextSecondary)
                            }

                            // 三个动作按钮，Botanical 样式
                            HStack(spacing: 8) {
                                BotanicalButton(title: "Open", variant: .primary) {
                                    onOpen(workout)
                                }

                                BotanicalButton(title: "Copy", variant: .secondary) {
                                    onCopy(workout)
                                }

                                BotanicalButton(title: "Delete", variant: .danger) {
                                    onDelete(workout)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
```

**同时确认 `BotanicalButton.swift` 有 `.danger` variant。** 如果没有，添加：

```swift
// BotanicalButton.swift 中
enum BotanicalButtonVariant {
    case primary, secondary, danger
}

// body 中的 switch
case .danger:
    label
        .font(.botanicalSemibold(15))
        .foregroundStyle(Color.white)
        .frame(maxWidth: .infinity, minHeight: 44)
        .background(Color.red.opacity(0.85))
        .clipShape(RoundedRectangle(cornerRadius: BotanicalTheme.controlCornerRadius, style: .continuous))
```

### 验收标准
- Open = Botanical Primary 按钮（botanicalEmphasis 或 botanicalAccent 背景）
- Copy = Botanical Secondary 按钮（botanicalMuted 背景）
- Delete = Danger 按钮（红色背景）
- 按下有 PressableButtonStyle 缩放动画
- "In Progress" / "Completed" 状态标签正确显示

---

## 问题三：ProfileSettingsView 全部使用 iOS 原生 Form 样式

### 现状分析

`Views/Profile/ProfileSettingsView.swift`（当前 122 行）使用：
- `Form { Section("Unit") { Picker... } }` — iOS 系统白底表格，SF Pro 字体
- `.pickerStyle(.segmented)` — iOS 蓝色分段控件
- `Toggle` — iOS 系统绿色开关
- 整体看起来像 iOS 系统"设置"App，与 Botanical 设计完全割裂

### 修复方案

**完整替换 `ProfileSettingsView.swift`：**

```swift
import SwiftUI

struct ProfileSettingsView: View {
    @Environment(AppStore.self) private var store
    @State private var showExporter = false
    @State private var exportURL: URL?

    private var prefs: UserPreferences { store.user?.preferences ?? UserPreferences() }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {

                // ── 单位 ──────────────────────────────────────
                settingCard(title: "Unit") {
                    HStack(spacing: 10) {
                        unitChip("KG", selected: prefs.defaultUnit == .kg) {
                            if prefs.defaultUnit != .kg { store.toggleUnit() }
                        }
                        unitChip("LBS", selected: prefs.defaultUnit == .lbs) {
                            if prefs.defaultUnit != .lbs { store.toggleUnit() }
                        }
                        Spacer()
                    }
                }

                // ── 休息计时 ───────────────────────────────────
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

                // ── 主题 ───────────────────────────────────────
                settingCard(title: "Theme") {
                    HStack(spacing: 10) {
                        themeChip("Light", icon: "sun.max", mode: .light, current: prefs.themeMode)
                        themeChip("Dark",  icon: "moon",    mode: .dark,  current: prefs.themeMode)
                        themeChip("Auto",  icon: "circle.lefthalf.filled", mode: .system, current: prefs.themeMode)
                        Spacer()
                    }
                }

                // ── 通知 ───────────────────────────────────────
                settingCard(title: "Notifications") {
                    HStack {
                        Text("Workout reminders")
                            .font(.botanicalBody(15))
                            .foregroundStyle(Color.botanicalTextPrimary)
                        Spacer()
                        // 自定义开关
                        botanicalToggle(isOn: Binding(
                            get: { prefs.notificationsEnabled },
                            set: { store.setNotificationsEnabled($0) }
                        ))
                    }
                }

                // ── 导出 ───────────────────────────────────────
                settingCard(title: "Export Data") {
                    VStack(spacing: 10) {
                        BotanicalButton(title: "Export as JSON", variant: .secondary) { exportJSON() }
                        BotanicalButton(title: "Export as CSV",  variant: .secondary) { exportCSV() }
                    }
                }

                // ── 危险区域 ──────────────────────────────────
                settingCard(title: "Account") {
                    BotanicalButton(title: "Sign Out", variant: .danger) {
                        Task { await store.logout() }
                    }
                }

            }
            .padding(.horizontal, 24)
            .padding(.top, 16)
            .padding(.bottom, 60)
        }
        .background(Color.botanicalBackground.ignoresSafeArea())
        .navigationTitle("Settings")
        .sheet(isPresented: $showExporter) {
            if let exportURL { ShareSheet(items: [exportURL]) }
        }
    }

    // MARK: - Subviews

    private func settingCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.botanicalTextSecondary)
                .tracking(1.2)

            BotanicalCard {
                content()
            }
        }
    }

    private func unitChip(_ label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.botanicalSemibold(14))
                .foregroundStyle(selected ? Color.botanicalTextPrimary : Color.botanicalTextSecondary)
                .frame(width: 68, height: 40)
                .background(selected ? Color.botanicalAccent : Color.botanicalMuted.opacity(0.6))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(PressableButtonStyle())
        .animation(.easeOut(duration: 0.2), value: selected)
    }

    private func timerChip(_ label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.botanicalSemibold(13))
                .foregroundStyle(selected ? Color.botanicalTextPrimary : Color.botanicalTextSecondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(selected ? Color.botanicalAccent : Color.botanicalMuted.opacity(0.6))
                .clipShape(Capsule())
        }
        .buttonStyle(PressableButtonStyle())
        .animation(.easeOut(duration: 0.2), value: selected)
    }

    private func themeChip(_ label: String, icon: String, mode: ThemeMode, current: ThemeMode) -> some View {
        let selected = current == mode
        return Button {
            store.setThemeMode(mode)
        } label: {
            HStack(spacing: 5) {
                Image(systemName: icon).font(.system(size: 13))
                Text(label).font(.botanicalSemibold(13))
            }
            .foregroundStyle(selected ? Color.botanicalTextPrimary : Color.botanicalTextSecondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(selected ? Color.botanicalAccent : Color.botanicalMuted.opacity(0.6))
            .clipShape(Capsule())
        }
        .buttonStyle(PressableButtonStyle())
        .animation(.easeOut(duration: 0.2), value: selected)
    }

    private func botanicalToggle(isOn: Binding<Bool>) -> some View {
        Button {
            isOn.wrappedValue.toggle()
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        } label: {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(isOn.wrappedValue ? Color.botanicalAccent : Color.botanicalMuted)
                .frame(width: 50, height: 28)
                .overlay(
                    Circle()
                        .fill(Color.white)
                        .frame(width: 22, height: 22)
                        .offset(x: isOn.wrappedValue ? 11 : -11)
                        .animation(.spring(duration: 0.25, bounce: 0.25), value: isOn.wrappedValue)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Export

    private func exportJSON() {
        let payload: [String: Any] = [
            "exportedAt": ISO8601DateFormatter().string(from: Date()),
            "workouts": store.workouts.map { w in
                [
                    "id": w.id, "date": w.date, "title": w.title,
                    "completed": w.completed, "elapsedSeconds": w.elapsedSeconds,
                    "exercises": w.exercises.map { ex in
                        ["defId": ex.defId,
                         "sets": ex.sets.map { s in
                             ["weight": s.weight, "reps": s.reps, "completed": s.completed]
                         }]
                    }
                ] as [String: Any]
            },
            "exerciseDefs": store.exerciseDefs.map { ["id": $0.id, "name": $0.name, "category": $0.category] }
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: .prettyPrinted) else { return }
        let url = FileManager.default.temporaryDirectory
            .appending(path: "ironlog-export-\(UUID().uuidString).json")
        try? data.write(to: url)
        exportURL = url
        showExporter = true
    }

    private func exportCSV() {
        var lines = ["date,title,exercises,completed,duration_min"]
        for w in store.workouts {
            let mins = Int(w.elapsedSeconds / 60)
            lines.append("\(w.date),\"\(w.title)\",\(w.exercises.count),\(w.completed),\(mins)")
        }
        let url = FileManager.default.temporaryDirectory
            .appending(path: "ironlog-export-\(UUID().uuidString).csv")
        try? lines.joined(separator: "\n").data(using: .utf8)?.write(to: url)
        exportURL = url
        showExporter = true
    }
}

private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
```

### 验收标准
- 整个 Settings 页面无任何 iOS 系统 Form/Section 样式
- 所有控件（单位、休息计时、主题）为 Botanical 胶囊/圆角卡片
- 开关为自定义滑动动画 Toggle（非系统绿色 Toggle）
- 按压所有按钮有 PressableButtonStyle 缩放反馈
- 导出按钮触发 ShareSheet

---

## 问题四：全局导航栏字体仍为 iOS 系统 SF Pro

### 现状分析

自定义字体 `PlayfairDisplay-SemiBold` 和 `SourceSans3-SemiBold` 在内容区域（`.font(.display(...))` 等）已正确应用。但以下地方仍显示系统 SF Pro：

1. **NavigationBar 标题** — `.navigationTitle("Settings")` 等所有导航栏标题
2. **工具栏按钮** — `.toolbar { ToolbarItem { Button("Done") } }` 的按钮文字
3. **所有 Sheet 的导航标题** — `ExercisePickerSheet`、`ExerciseDetailModal` 等 `.navigationTitle("Pick Exercise")`

### 修复方案

**在 `App/IronLogApp.swift` 的 `init()` 中设置全局 UINavigationBar 外观：**

```swift
// IronLogApp.swift

@main
struct IronLogApp: App {
    // ... 现有代码 ...

    init() {
        configureNavigationBarAppearance()
    }

    private func configureNavigationBarAppearance() {
        // 标题字体（inline/standard 尺寸）
        let titleAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont(name: "SourceSans3-SemiBold", size: 17) ?? UIFont.systemFont(ofSize: 17, weight: .semibold),
            .foregroundColor: UIColor { traitCollection in
                traitCollection.userInterfaceStyle == .dark
                    ? UIColor(red: 0.965, green: 0.953, blue: 0.929, alpha: 1)  // #F6F3ED
                    : UIColor(red: 0.176, green: 0.227, blue: 0.192, alpha: 1)  // #2D3A31
            }
        ]

        // 大标题字体（scrollEdge 时）
        let largeTitleAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont(name: "PlayfairDisplay-SemiBold", size: 34) ?? UIFont.systemFont(ofSize: 34, weight: .bold),
            .foregroundColor: UIColor { traitCollection in
                traitCollection.userInterfaceStyle == .dark
                    ? UIColor(red: 0.965, green: 0.953, blue: 0.929, alpha: 1)
                    : UIColor(red: 0.176, green: 0.227, blue: 0.192, alpha: 1)
            }
        ]

        let appearance = UINavigationBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.backgroundColor = UIColor(Color.botanicalBackground)
        appearance.titleTextAttributes = titleAttributes
        appearance.largeTitleTextAttributes = largeTitleAttributes
        // 移除底部分隔线
        appearance.shadowColor = .clear

        UINavigationBar.appearance().standardAppearance = appearance
        UINavigationBar.appearance().scrollEdgeAppearance = appearance
        UINavigationBar.appearance().compactAppearance = appearance
        UINavigationBar.appearance().tintColor = UIColor { traitCollection in
            traitCollection.userInterfaceStyle == .dark
                ? UIColor(red: 0.549, green: 0.604, blue: 0.518, alpha: 1)  // botanicalAccent dark
                : UIColor(red: 0.549, green: 0.604, blue: 0.518, alpha: 1)  // botanicalAccent light
        }
    }

    var body: some Scene {
        // ... 现有代码不变 ...
    }
}
```

**同时对所有 Sheet/Modal 做以下修改，避免重复导航标题：**

对于 `ExercisePickerSheet`、`ExerciseDetailModal`、`CreateExerciseSheet`、`EditExerciseSheet`、`RestTimerView`、`SessionReportView` 等含 `NavigationStack` 的 sheet：

- 将 `.navigationTitle("Pick Exercise")` 改为 `.navigationTitle("")` + 在内容顶部用 `Text("Pick Exercise").font(.display(24))` 显示标题
- **或者** 保留 `.navigationTitle()` 让系统渲染（配合上面的 UIAppearance 自动应用自定义字体）

推荐方案：保留 `.navigationTitle()` + UIAppearance，同时对主视图（Dashboard、Calendar、Stats、Profile）移除 `.navigationTitle()` 改用内容区域顶部的 `Text(...).font(.display(40))` 标题（这些视图已有此实现，只需确保不再同时有 navigationTitle）。

### 验收标准
- 所有导航栏内联标题（Sheet 标题）使用 SourceSans3-SemiBold
- 工具栏按钮（Done、Close、Save 等）tintColor 为 botanicalAccent 色
- NavigationBar 背景透明/配合 botanicalBackground

---

## 问题五：登录页面缺少邮箱登录选项

### 现状分析

`Services/Auth/PrivyAuthService.swift`（当前 119 行）的 `PrivyLoginProvider` enum 只有两个 case：

```swift
enum PrivyLoginProvider: String, CaseIterable, Identifiable, Sendable {
    case google
    case apple
    // ← 缺少 email
}
```

`Views/Auth/LoginView.swift` 用 `confirmationDialog` 展示所有 `PrivyLoginProvider.allCases`，因此登录选项只有 Google 和 Apple。

**Privy SDK 支持 Email OTP 登录**（通过 `privy.email.sendCode(to:)` 和 `privy.email.loginWithCode(_:sentTo:)`），但这里完全没有实现。

### 修复方案

#### Step 1: 更新 `PrivyAuthService.swift`

```swift
enum PrivyLoginProvider: String, CaseIterable, Identifiable, Sendable {
    case google
    case apple
    case email  // 新增

    var id: String { rawValue }

    var title: String {
        switch self {
        case .google: return "Continue with Google"
        case .apple:  return "Continue with Apple"
        case .email:  return "Continue with Email"
        }
    }

    // email case 不需要 oauthProvider，仅用于 UI 判断
    var oauthProvider: OAuthProvider? {
        switch self {
        case .google: return .google
        case .apple:  return .apple
        case .email:  return nil
        }
    }
}
```

在 `PrivyAuthService` class 中新增两个方法：

```swift
/// 发送 Email OTP 验证码
func sendEmailOTP(to emailAddress: String) async throws {
    try await privy.email.sendCode(to: emailAddress)
}

/// 使用 OTP 验证码登录
func verifyEmailOTP(code: String, to emailAddress: String) async throws -> PrivyNativeLoginResult {
    let user = try await privy.email.loginWithCode(code, sentTo: emailAddress)
    let token = try await user.getAccessToken()
    let exchange = try await tokenExchangeService.exchange(privyToken: token)
    let profile = profileFromPrivyUser(user, fallbackProvider: .email)
    return PrivyNativeLoginResult(exchange: exchange, profile: profile)
}
```

同时修改现有 `loginWithOAuth` 使其只处理 oauth（email 走新流程）：

```swift
// 保持原有 loginWithOAuth，确保只有 google/apple 会调用
func loginWithOAuth(provider: PrivyLoginProvider) async throws -> PrivyNativeLoginResult {
    guard let oauthProvider = provider.oauthProvider else {
        throw NSError(domain: "PrivyAuth", code: -1,
                      userInfo: [NSLocalizedDescriptionKey: "Use sendEmailOTP for email login"])
    }
    let user = try await privy.oAuth.login(
        with: oauthProvider,
        appUrlScheme: Constants.privyAppURLScheme
    )
    // ... 其余不变
}
```

#### Step 2: 更新 `AppStore.swift` 新增两个 action

在 `AppStore.swift` 中（在现有 `loginWithPrivy` 旁边）：

```swift
/// 发送 Email OTP — 不直接登录，仅触发验证码发送
func sendEmailOTP(to email: String) async {
    do {
        try await authService.sendEmailOTP(to: email)
    } catch {
        authError = error.localizedDescription
    }
}

/// 验证 Email OTP，成功则完成登录
func verifyEmailOTP(code: String, email: String) async {
    isLoading = true
    authError = nil
    defer { isLoading = false }
    do {
        let result = try await authService.verifyEmailOTP(code: code, to: email)
        await completeLogin(result: result)
    } catch {
        authError = "Invalid code. Please try again."
    }
}
```

（`completeLogin` 为现有登录完成逻辑的提取，或直接内联）

#### Step 3: 更新 `LoginView.swift`

```swift
import SwiftUI

struct LoginView: View {
    @Environment(AppStore.self) private var store

    // 多步骤登录状态
    enum LoginStep {
        case initial
        case emailEntry       // 输入邮箱
        case otpEntry(String) // 输入验证码（参数为邮箱）
    }

    @State private var loginStep: LoginStep = .initial
    @State private var emailInput = ""
    @State private var otpInput = ""
    @State private var isEmailSending = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // Logo
            VStack(spacing: 8) {
                Text("IronLog")
                    .font(.display(52))
                    .foregroundStyle(Color.botanicalTextPrimary)
                Text("Your strength. Your record.")
                    .font(.botanicalBody(16))
                    .foregroundStyle(Color.botanicalTextSecondary)
            }
            .padding(.bottom, 48)

            // 错误提示
            if let error = store.authError, !error.isEmpty {
                Text(error)
                    .font(.botanicalBody(13))
                    .foregroundStyle(.red)
                    .padding(12)
                    .background(Color.red.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .padding(.bottom, 16)
                    .padding(.horizontal, 4)
            }

            // 根据步骤显示不同内容
            switch loginStep {

            // ── 初始步骤：三个登录按钮 ──────────────────────
            case .initial:
                VStack(spacing: 12) {
                    oauthButton(
                        icon: "g.circle.fill",
                        title: "Continue with Google",
                        color: Color(hex: "#4285F4")
                    ) {
                        Task { await store.loginWithPrivy(provider: .google) }
                    }

                    oauthButton(
                        icon: "apple.logo",
                        title: "Continue with Apple",
                        color: Color.botanicalTextPrimary
                    ) {
                        Task { await store.loginWithPrivy(provider: .apple) }
                    }

                    // 分隔线
                    HStack {
                        Rectangle().fill(Color.botanicalBorderSubtle).frame(height: 1)
                        Text("or")
                            .font(.botanicalBody(13))
                            .foregroundStyle(Color.botanicalTextSecondary)
                            .padding(.horizontal, 12)
                        Rectangle().fill(Color.botanicalBorderSubtle).frame(height: 1)
                    }

                    oauthButton(
                        icon: "envelope.fill",
                        title: "Continue with Email",
                        color: Color.botanicalAccent
                    ) {
                        withAnimation(.easeOut(duration: 0.25)) {
                            loginStep = .emailEntry
                        }
                    }
                }

            // ── 邮箱输入步骤 ────────────────────────────────
            case .emailEntry:
                VStack(spacing: 16) {
                    Text("Enter your email")
                        .font(.botanicalSemibold(18))
                        .foregroundStyle(Color.botanicalTextPrimary)

                    BotanicalTextField(title: "Email address", value: $emailInput)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                    BotanicalButton(
                        title: isEmailSending ? "Sending..." : "Send Code",
                        variant: .primary,
                        disabled: emailInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isEmailSending
                    ) {
                        let email = emailInput.trimmingCharacters(in: .whitespacesAndNewlines)
                        isEmailSending = true
                        Task {
                            await store.sendEmailOTP(to: email)
                            isEmailSending = false
                            if store.authError == nil {
                                withAnimation(.easeOut(duration: 0.25)) {
                                    loginStep = .otpEntry(email)
                                }
                            }
                        }
                    }

                    Button("Back") {
                        withAnimation(.easeOut(duration: 0.25)) {
                            loginStep = .initial
                            store.authError = nil
                        }
                    }
                    .font(.botanicalBody(14))
                    .foregroundStyle(Color.botanicalTextSecondary)
                }

            // ── OTP 验证步骤 ────────────────────────────────
            case .otpEntry(let email):
                VStack(spacing: 16) {
                    Text("Check your email")
                        .font(.botanicalSemibold(18))
                        .foregroundStyle(Color.botanicalTextPrimary)

                    Text("We sent a code to **\(email)**")
                        .font(.botanicalBody(14))
                        .foregroundStyle(Color.botanicalTextSecondary)
                        .multilineTextAlignment(.center)

                    BotanicalTextField(title: "6-digit code", value: $otpInput)
                        .keyboardType(.numberPad)

                    BotanicalButton(
                        title: store.isLoading ? "Verifying..." : "Verify",
                        variant: .primary,
                        disabled: otpInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.isLoading
                    ) {
                        Task {
                            await store.verifyEmailOTP(
                                code: otpInput.trimmingCharacters(in: .whitespacesAndNewlines),
                                email: email
                            )
                        }
                    }

                    Button("Resend code") {
                        Task { await store.sendEmailOTP(to: email) }
                    }
                    .font(.botanicalBody(14))
                    .foregroundStyle(Color.botanicalAccent)

                    Button("Back") {
                        withAnimation(.easeOut(duration: 0.25)) {
                            loginStep = .emailEntry
                            otpInput = ""
                            store.authError = nil
                        }
                    }
                    .font(.botanicalBody(14))
                    .foregroundStyle(Color.botanicalTextSecondary)
                }
            }

            Spacer()

            // Dev fallback（保留，但折叠成小字）
            #if DEBUG
            disclosureGroup_devFallback
            #endif
        }
        .padding(28)
        .background(Color.botanicalBackground.ignoresSafeArea())
    }

    // MARK: - OAuth 按钮模板
    private func oauthButton(icon: String, title: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(color)
                    .frame(width: 24)
                Text(title)
                    .font(.botanicalSemibold(16))
                    .foregroundStyle(Color.botanicalTextPrimary)
                Spacer()
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 20)
            .frame(height: 52)
            .background(Color.botanicalSurface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.botanicalBorderSubtle, lineWidth: 1)
            )
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(store.isLoading)
    }

    // Dev fallback（调试用）
    private var disclosureGroup_devFallback: some View {
        VStack(spacing: 8) {
            Text("Dev: paste Privy token")
                .font(.system(size: 11))
                .foregroundStyle(Color.botanicalTextSecondary)
            // 保留现有逻辑
        }
        .padding(.top, 12)
    }
}
```

**同时在 `Color+Botanical.swift` 添加 hex 初始化器（如尚未添加）：**

```swift
extension Color {
    init(hex: String) {
        let clean = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: clean).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8) & 0xFF) / 255
        let b = Double(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
```

### 验收标准
- 登录页显示 Google、Apple、Email 三个选项
- 点击 Email 进入邮箱输入步骤（无 confirmationDialog）
- 成功发送 OTP 后进入验证码输入步骤
- 验证成功后正常登录进入主界面
- 所有步骤有流畅的 withAnimation 过渡
- 错误信息正确显示（发送失败、验证失败）

---

## 问题六：Stats 界面图表不全（缺少 3 个图表，1 个图表内容不完整）

### 现状分析

**PWA StatsView 共有 6 个 section（按顺序）：**

| # | Section | 图表类型 | iOS 状态 |
|---|---------|---------|---------|
| 1 | Training Load Insight | 组合图（BarChart + 虚线 baseline LineChart）+ 3 个统计卡片 | ⚠️ 仅有文字卡，无图表 |
| 2 | Weekly Frequency | LineChart（每周训练次数） | ❌ 完全缺失 |
| 3 | Weekly Volume | BarChart（每周总重量） | ✓ 已实现（WeeklyVolumeChart） |
| 4 | 1RM Trend | LineChart（选定练习 1RM 曲线） | ✓ 已实现（OneRMTrendChart） |
| 5 | Workout Duration | BarChart（每次训练时长/分钟） | ❌ 完全缺失 |
| 6 | Body Part Split | PieChart + 右侧图例列表 | ⚠️ 有图无图例 |

**需要新增/修复的内容：**

1. **LoadRiskView 内嵌组合图** — 在现有的文字 card 内加入 bar+dashed-line 组合图
2. **新建 WeeklyFrequencyChart.swift** — 折线图（workoutCount per week）
3. **新建 WorkoutDurationChart.swift** — 柱状图（duration in minutes per session）
4. **修复 BodyPartPieChart** — 加入右侧图例列表

### 6.1 修复 `LoadRiskView.swift`（添加内嵌组合图）

PWA 的 Load Insight card 展示：
- 顶部：标题 + 状态徽章
- 中部：3 个小统计卡（Acute Load、Baseline Load、Ratio）
- 下部：BarChart（近 8 周每周 volume）+ 虚线（baseline 移动平均）

**完整替换 `Views/Stats/LoadRiskView.swift`：**

```swift
import Charts
import SwiftUI

struct LoadRiskView: View {
    let insight: LoadInsight
    // 新增：近 8 周的数据，用于绘制组合图
    let trendPoints: [(label: String, volume: Double, baseline: Double, isCurrent: Bool)]

    var statusColor: Color {
        switch insight.level {
        case .high:        return Color(hex: "EF4444")   // red
        case .elevated:    return Color.botanicalEmphasis
        case .low:         return Color(hex: "38BDF8")   // sky
        case .normal:      return Color.botanicalSuccess
        case .insufficient: return Color.botanicalTextSecondary
        }
    }

    var statusLabel: String {
        switch insight.level {
        case .high:        return "High Risk"
        case .elevated:    return "Elevated"
        case .low:         return "Low"
        case .normal:      return "Normal"
        case .insufficient: return "Insufficient Data"
        }
    }

    var adviceText: String {
        switch insight.level {
        case .high:        return "This week's load is significantly above baseline. Consider reducing intensity."
        case .elevated:    return "Training load is elevated. Monitor fatigue and recovery closely."
        case .low:         return "Training load is below baseline. Consider gradually increasing volume."
        case .normal:      return "Load is progressing well within safe limits."
        case .insufficient: return "Train at least 3 weeks consistently to see load analysis."
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {

            // 标题行 + 状态徽章
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("TRAINING LOAD")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.botanicalTextSecondary)
                        .tracking(1.2)
                    Text("Acute vs Baseline Workload")
                        .font(.botanicalBody(12))
                        .foregroundStyle(Color.botanicalTextSecondary)
                }
                Spacer()
                Text(statusLabel.uppercased())
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(statusColor)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(statusColor.opacity(0.12))
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(statusColor.opacity(0.3), lineWidth: 1))
            }

            // 建议文字
            Text(adviceText)
                .font(.botanicalBody(13))
                .foregroundStyle(Color.botanicalTextPrimary)

            // 3 个统计小卡
            HStack(spacing: 8) {
                statMiniCard("Acute", value: formatVolume(insight.acuteVolume))
                statMiniCard("Baseline", value: formatVolume(insight.baselineVolume))
                statMiniCard("Ratio", value: insight.ratio.map { String(format: "%.2f", $0) } ?? "—")
            }

            // 组合图：柱状 volume + 虚线 baseline
            if !trendPoints.isEmpty {
                Chart {
                    ForEach(trendPoints, id: \.label) { point in
                        BarMark(
                            x: .value("Week", point.label),
                            y: .value("Volume", point.volume)
                        )
                        .foregroundStyle(
                            point.isCurrent
                                ? Color.botanicalEmphasis
                                : Color.botanicalAccent.opacity(0.7)
                        )
                        .cornerRadius(5)
                    }
                    ForEach(trendPoints, id: \.label) { point in
                        LineMark(
                            x: .value("Week", point.label),
                            y: .value("Baseline", point.baseline)
                        )
                        .foregroundStyle(Color.botanicalTextSecondary.opacity(0.6))
                        .lineStyle(StrokeStyle(lineWidth: 2, dash: [5, 4]))
                        .interpolationMethod(.monotone)
                    }
                }
                .chartXAxis {
                    AxisMarks(values: .automatic) { _ in
                        AxisValueLabel().font(.botanicalBody(10))
                    }
                }
                .chartYAxis {
                    AxisMarks(values: .automatic) { _ in
                        AxisValueLabel().font(.botanicalBody(10))
                        AxisGridLine()
                    }
                }
                .frame(height: 160)

                // 图例
                HStack(spacing: 16) {
                    legendDot(color: Color.botanicalAccent, label: "Weekly Volume")
                    legendDash(color: Color.botanicalTextSecondary, label: "Baseline (4w avg)")
                }
                .font(.botanicalBody(11))
                .foregroundStyle(Color.botanicalTextSecondary)
            }
        }
        .padding(16)
        .botanicalCard()
    }

    private func statMiniCard(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color.botanicalTextSecondary)
                .tracking(0.8)
            Text(value)
                .font(.botanicalSemibold(14))
                .foregroundStyle(Color.botanicalTextPrimary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func legendDot(color: Color, label: String) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(label)
        }
    }

    private func legendDash(color: Color, label: String) -> some View {
        HStack(spacing: 5) {
            Rectangle()
                .fill(color)
                .frame(width: 14, height: 2)
                .overlay(
                    HStack(spacing: 3) {
                        ForEach(0..<2) { _ in
                            Rectangle().fill(Color.botanicalBackground).frame(width: 3, height: 2)
                        }
                    }
                )
            Text(label)
        }
    }

    private func formatVolume(_ v: Double) -> String {
        v >= 1000 ? String(format: "%.1fk", v / 1000) : "\(Int(v))"
    }
}
```

### 6.2 新建 `WeeklyFrequencyChart.swift`

```swift
// Views/Stats/WeeklyFrequencyChart.swift
import Charts
import SwiftUI

struct WeeklyFrequencyChart: View {
    // (label: "M/d", count: Int)
    let points: [(label: String, count: Int)]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("WEEKLY FREQUENCY")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.botanicalTextSecondary)
                .tracking(1.2)

            if points.allSatisfy({ $0.count == 0 }) {
                Text("No completed workouts yet")
                    .font(.botanicalBody(14))
                    .foregroundStyle(Color.botanicalTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 32)
            } else {
                Chart(points, id: \.label) { point in
                    LineMark(
                        x: .value("Week", point.label),
                        y: .value("Workouts", point.count)
                    )
                    .foregroundStyle(Color.botanicalAccent)
                    .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round))
                    .interpolationMethod(.monotone)

                    AreaMark(
                        x: .value("Week", point.label),
                        y: .value("Workouts", point.count)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color.botanicalAccent.opacity(0.25), Color.botanicalAccent.opacity(0)],
                            startPoint: .top, endPoint: .bottom
                        )
                    )
                    .interpolationMethod(.monotone)

                    PointMark(
                        x: .value("Week", point.label),
                        y: .value("Workouts", point.count)
                    )
                    .foregroundStyle(Color.botanicalAccent)
                    .symbolSize(28)
                }
                .chartXAxis {
                    AxisMarks(values: .stride(by: 2)) { _ in
                        AxisValueLabel().font(.botanicalBody(10))
                    }
                }
                .chartYAxis {
                    AxisMarks(values: .automatic(desiredCount: 4)) { value in
                        AxisValueLabel().font(.botanicalBody(10))
                        AxisGridLine()
                    }
                }
                .frame(height: 180)
            }
        }
        .padding(16)
        .botanicalCard()
    }
}
```

### 6.3 新建 `WorkoutDurationChart.swift`

```swift
// Views/Stats/WorkoutDurationChart.swift
import Charts
import SwiftUI

struct WorkoutDurationChart: View {
    // (label: "序号", date: "MM/dd", minutes: Int)
    let points: [(label: String, date: String, minutes: Int)]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("WORKOUT DURATION")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.botanicalTextSecondary)
                .tracking(1.2)

            if points.isEmpty {
                Text("No elapsed time recorded")
                    .font(.botanicalBody(14))
                    .foregroundStyle(Color.botanicalTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 32)
            } else {
                Chart(points, id: \.label) { point in
                    BarMark(
                        x: .value("Session", point.label),
                        y: .value("Minutes", point.minutes)
                    )
                    .foregroundStyle(Color.botanicalAccent)
                    .cornerRadius(5)
                    .annotation(position: .top, alignment: .center) {
                        if point.minutes > 0 {
                            Text("\(point.minutes)m")
                                .font(.system(size: 9, weight: .medium))
                                .foregroundStyle(Color.botanicalTextSecondary)
                        }
                    }
                }
                .chartXAxis {
                    AxisMarks(values: .automatic) { _ in
                        AxisValueLabel().font(.botanicalBody(10))
                    }
                }
                .chartYAxis {
                    AxisMarks(values: .automatic(desiredCount: 4)) { value in
                        AxisValueLabel {
                            if let v = value.as(Int.self) {
                                Text("\(v)m").font(.botanicalBody(10))
                            }
                        }
                        AxisGridLine()
                    }
                }
                .frame(height: 180)
            }
        }
        .padding(16)
        .botanicalCard()
    }
}
```

### 6.4 修复 `BodyPartPieChart.swift`（添加图例）

```swift
import Charts
import SwiftUI

struct BodyPartPieChart: View {
    let values: [(category: String, value: Double)]

    private let colors: [Color] = [
        Color(hex: "8C9A84"), Color(hex: "7F9B97"), Color(hex: "C27B66"),
        Color(hex: "6F8D73"), Color(hex: "AFBCAA"), Color(hex: "9FB298"),
        Color(hex: "D49B87")
    ]

    private var total: Double { values.reduce(0) { $0 + $1.value } }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("BODY PART SPLIT")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.botanicalTextSecondary)
                .tracking(1.2)

            HStack(alignment: .center, spacing: 16) {
                // 甜甜圈图
                Chart(Array(values.enumerated()), id: \.offset) { idx, item in
                    SectorMark(
                        angle: .value("Value", item.value),
                        innerRadius: .ratio(0.58),
                        angularInset: 1.2
                    )
                    .foregroundStyle(colors[idx % colors.count])
                    .cornerRadius(3)
                }
                .frame(width: 150, height: 150)

                // 图例列表
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(values.prefix(6).enumerated()), id: \.offset) { idx, item in
                        HStack(spacing: 8) {
                            Circle()
                                .fill(colors[idx % colors.count])
                                .frame(width: 10, height: 10)
                            Text(item.category)
                                .font(.botanicalBody(13))
                                .foregroundStyle(Color.botanicalTextPrimary)
                            Spacer()
                            Text("\(Int(item.value))")
                                .font(.botanicalSemibold(13))
                                .foregroundStyle(Color.botanicalTextSecondary)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(16)
        .botanicalCard()
    }
}
```

### 6.5 更新 `StatsService.swift`（新增两个计算方法）

在 `StatsService.swift` 中添加：

```swift
/// 每周训练次数（过去 N 周）
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
    return buckets
}

/// 各 workout 的时长数据（最近 N 次，有 elapsedSeconds > 0 的）
static func workoutDurations(workouts: [Workout], limit: Int = 16) -> [(date: String, minutes: Int)] {
    return workouts
        .filter { $0.completed && $0.elapsedSeconds > 0 }
        .sorted { $0.date < $1.date }
        .suffix(limit)
        .map { workout in
            let mins = max(0, Int(workout.elapsedSeconds / 60))
            return (date: String(workout.date.suffix(5)), minutes: mins)  // "MM-dd"
        }
}

/// 用于 LoadRisk 组合图的趋势数据（近 8 周，含 baseline 移动平均）
static func loadTrendPoints(weeklyVolumes vols: [(weekStart: Date, volume: Double)]) -> [(label: String, volume: Double, baseline: Double, isCurrent: Bool)] {
    let formatter = DateFormatter()
    formatter.dateFormat = "M/d"

    let recent = Array(vols.suffix(8))
    return recent.enumerated().map { idx, point in
        let baselineWindow = recent[max(0, idx - 4)..<idx].map(\.volume)
        let baseline = baselineWindow.isEmpty ? 0 : baselineWindow.reduce(0, +) / Double(baselineWindow.count)
        return (
            label: formatter.string(from: point.weekStart),
            volume: point.volume,
            baseline: baseline,
            isCurrent: idx == recent.count - 1
        )
    }
}
```

### 6.6 更新 `StatsView.swift`（整合所有图表，按 PWA 顺序排列）

```swift
import SwiftUI

struct StatsView: View {
    @Environment(AppStore.self) private var store
    @State private var viewModel = StatsViewModel()

    private var completed: [Workout] {
        store.workouts.filter(\.completed).sorted { $0.date < $1.date }
    }

    // 每周数据（既有 volume 又有 count）
    private var weeklyVolumes: [(weekStart: Date, volume: Double)] {
        StatsService.weeklyVolumes(workouts: completed)
    }

    private var weeklyChartData: [(label: String, volume: Double)] {
        let formatter = DateFormatter()
        formatter.dateFormat = "M/d"
        return weeklyVolumes.map { (formatter.string(from: $0.weekStart), $0.volume) }
    }

    private var weeklyFreqData: [(label: String, count: Int)] {
        let formatter = DateFormatter()
        formatter.dateFormat = "M/d"
        return StatsService.weeklyWorkoutCounts(workouts: completed).map {
            (formatter.string(from: $0.weekStart), $0.count)
        }
    }

    private var loadInsight: LoadInsight {
        StatsService.loadInsight(weeklyVolumes: weeklyVolumes.map(\.volume))
    }

    private var loadTrendPoints: [(label: String, volume: Double, baseline: Double, isCurrent: Bool)] {
        StatsService.loadTrendPoints(weeklyVolumes: weeklyVolumes)
    }

    private var selectedExerciseId: String? {
        viewModel.selectedExerciseID ?? selectableExercises.first?.id
    }

    private var selectableExercises: [ExerciseDef] {
        let ids = Set(completed.flatMap { $0.exercises.map(\.defId) })
        return store.exerciseDefs.filter { ids.contains($0.id) }
    }

    private var oneRMTrend: [(String, Double)] {
        guard let id = selectedExerciseId else { return [] }
        return completed.compactMap { workout in
            let sets = workout.exercises.filter { $0.defId == id }.flatMap(\.sets).filter(\.completed)
            guard !sets.isEmpty else { return nil }
            let best = sets.reduce(0.0) { max($0, $1.weight * (1 + Double($1.reps) / 30)) }
            return (workout.date, best)
        }
    }

    private var bodyPartDist: [(category: String, value: Double)] {
        var counts: [String: Double] = [:]
        let defById = Dictionary(uniqueKeysWithValues: store.exerciseDefs.map { ($0.id, $0) })
        for workout in completed {
            for exercise in workout.exercises {
                let cat = defById[exercise.defId]?.category ?? "Other"
                counts[cat, default: 0] += 1
            }
        }
        return counts.sorted { $0.value > $1.value }
    }

    private var durationData: [(label: String, date: String, minutes: Int)] {
        StatsService.workoutDurations(workouts: completed).enumerated().map { idx, item in
            (label: "\(idx + 1)", date: item.date, minutes: item.minutes)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Stats")
                    .font(.display(40))

                // 空数据状态
                if completed.isEmpty {
                    emptyState
                } else {
                    // 1. Training Load Insight（含组合图）
                    LoadRiskView(insight: loadInsight, trendPoints: loadTrendPoints)

                    // 2. Weekly Frequency
                    WeeklyFrequencyChart(points: weeklyFreqData)

                    // 3. Weekly Volume
                    VStack(alignment: .leading, spacing: 12) {
                        Text("WEEKLY VOLUME")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Color.botanicalTextSecondary)
                            .tracking(1.2)
                        WeeklyVolumeChart(points: weeklyChartData)
                    }
                    .padding(16)
                    .botanicalCard()

                    // 4. 1RM Trend（含练习选择器）
                    if !selectableExercises.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("1RM TREND")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(Color.botanicalTextSecondary)
                                    .tracking(1.2)
                                Spacer()
                                // 练习选择器
                                Menu {
                                    ForEach(selectableExercises) { def in
                                        Button(def.name) { viewModel.selectedExerciseID = def.id }
                                    }
                                } label: {
                                    HStack(spacing: 4) {
                                        Text(selectableExercises.first(where: { $0.id == selectedExerciseId })?.name ?? "Select")
                                            .font(.botanicalSemibold(13))
                                            .lineLimit(1)
                                        Image(systemName: "chevron.down").font(.system(size: 11))
                                    }
                                    .foregroundStyle(Color.botanicalAccent)
                                }
                            }

                            if oneRMTrend.isEmpty {
                                Text("No completed sets for this exercise")
                                    .font(.botanicalBody(13))
                                    .foregroundStyle(Color.botanicalTextSecondary)
                                    .padding(.vertical, 20)
                            } else {
                                OneRMTrendChart(points: oneRMTrend)
                            }
                        }
                        .padding(16)
                        .botanicalCard()
                    }

                    // 5. Workout Duration
                    WorkoutDurationChart(points: durationData)

                    // 6. Body Part Split（含图例）
                    if !bodyPartDist.isEmpty {
                        BodyPartPieChart(values: bodyPartDist)
                    }
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 20)
            .padding(.bottom, 120)
        }
        .background(Color.botanicalBackground.ignoresSafeArea())
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "chart.bar.xaxis")
                .font(.system(size: 40))
                .foregroundStyle(Color.botanicalMuted)
            Text("Complete workouts to see your stats")
                .font(.botanicalBody(15))
                .foregroundStyle(Color.botanicalTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
        .botanicalCard()
    }
}
```

**注意：** `LoadRiskView` 签名已变更，调用处需传入 `trendPoints` 参数。`WeeklyVolumeChart` 的 `body` 仅保留图表本身（去掉标题），标题改由 `StatsView` 中的 `Text("WEEKLY VOLUME")` 提供。

### 验收标准
- Stats 页显示 6 个 section，顺序与 PWA 一致
- Training Load card 内有组合图（bar + 虚线 baseline）
- Weekly Frequency 折线图显示每周训练次数
- Workout Duration 柱状图显示每次训练分钟数
- Body Part Split 饼图右侧有彩色图例列表
- 1RM Trend 选择器改为 Menu（避免水平滚动 capsule 挡住图表）

---

## 新增文件汇总

| 文件路径 | 说明 |
|---------|------|
| `Views/Stats/WeeklyFrequencyChart.swift` | 每周训练次数折线图（新建） |
| `Views/Stats/WorkoutDurationChart.swift` | 训练时长柱状图（新建） |

## 修改文件汇总

| 文件路径 | 修改内容 |
|---------|---------|
| `Views/WorkoutEditor/ExercisePickerSheet.swift` | 添加 ℹ️ 预览按钮 + ExerciseDetailModal sheet |
| `Views/Calendar/DayWorkoutListView.swift` | 完整替换：BotanicalButton + 状态标签 |
| `Views/Profile/ProfileSettingsView.swift` | 完整替换：移除 Form，使用 Botanical 卡片 |
| `App/IronLogApp.swift` | 添加 `configureNavigationBarAppearance()` |
| `Services/Auth/PrivyAuthService.swift` | 添加 email OTP 方法 + `.email` enum case |
| `Store/AppStore.swift` | 添加 `sendEmailOTP` / `verifyEmailOTP` action |
| `Views/Auth/LoginView.swift` | 完整替换：三步骤登录流程 |
| `Views/Stats/LoadRiskView.swift` | 完整替换：添加组合图 + trendPoints 参数 |
| `Views/Stats/BodyPartPieChart.swift` | 完整替换：添加图例列表 |
| `Views/Stats/StatsView.swift` | 完整替换：按 PWA 顺序整合所有 6 个图表 |
| `Services/Analytics/StatsService.swift` | 新增 `weeklyWorkoutCounts` / `workoutDurations` / `loadTrendPoints` 方法 |
| `Views/Shared/BotanicalButton.swift` | 添加 `.danger` variant（如尚未实现）|
| `Views/Shared/BotanicalTextField.swift` | 确认支持 `.keyboardType` 等修饰符传透 |

---

## 编译注意事项

1. **`LoadRiskView` 签名变更**：新增 `trendPoints` 参数，所有调用 `LoadRiskView(insight:)` 的地方（目前只有 `StatsView`）需更新为 `LoadRiskView(insight: ..., trendPoints: ...)`。

2. **`WeeklyVolumeChart` 参数类型不变**：仍接受 `[(label: String, volume: Double)]`，但在 `StatsView` 中调用时标题由外部 `Text` 提供，不要在 `WeeklyVolumeChart` 内部再加标题。

3. **Privy SDK Email API**：需确认当前使用的 `PrivySDK` 版本支持 `privy.email.sendCode(to:)` 和 `privy.email.loginWithCode(_:sentTo:)` API。如 API 名称不同，请参照 Privy iOS SDK 文档调整方法名，逻辑不变。

4. **`ExerciseDef: Identifiable`**：`sheet(item: $previewDef)` 需要 `ExerciseDef` conform to `Identifiable`。检查 `Core/Types.swift`，如 `ExerciseDef` 已有 `var id: String`，在文件末尾添加 `extension ExerciseDef: Identifiable {}` 即可。

5. **Color hex 初始化器**：`BodyPartPieChart` 中已有私有 `Color(hex:)` 扩展，`LoadRiskView` 和 `LoginView` 新代码也用到 `Color(hex:)`。建议将 `Color(hex:)` 移至 `DesignSystem/Color+Botanical.swift` 作为全局扩展，删除各文件中的私有副本。
