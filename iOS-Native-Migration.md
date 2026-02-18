# IronLog iOS 原生 App 重构框架文档

> **执行对象：CodeX AI**
> **项目名：** IronLog
> **目标：** 将现有 PWA（React + Vite）完全重构为 iOS 原生 App（Swift + SwiftUI）
> **平台：** iOS 17+ Only
> **后端：** 保留 Supabase + Privy（不改动后端代码）
> **目标：** 上架 App Store

---

## 背景与约束

**IronLog** 是一款健身记录 PWA，当前使用 React 19 + Vite + Tailwind CSS 构建，具备 Supabase 后端、Privy 认证、IndexedDB 离线队列、Botanical 设计系统、以及完整的 workout 追踪功能。

**重构核心约束：**
- Supabase 数据库 schema 不能改动（Web PWA 必须继续运行）
- 所有数据通过 Supabase Swift SDK 读写，schema 完全兼容
- Privy 认证保留，iOS 端用 WKWebView 嵌入 Privy 登录 UI 捕获 token
- 后端 Edge Function `token-exchange` 不变

**关键参考文件（PWA 源码）：**
- `src/context/GymContext.tsx` — 所有状态管理逻辑的完整来源（直接 port 为 `AppStore.swift`）
- `src/views/WorkoutEditor.tsx` — 最复杂的界面（1637行），自动保存、计时器、PR 计算
- `supabase/functions/token-exchange/index.ts` — Token 交换协议，Swift 端必须完全兼容
- `src/design/tokens.ts` — Botanical 设计 token 源（颜色、间距、阴影、动画时长）
- `src/services/syncQueue.ts` — 离线队列逻辑，用 SwiftData 替代 IndexedDB 完全复现
- `src/types.ts` — 所有 TypeScript 类型定义，直接对应 Swift struct/class

---

## 一、项目结构

```
IronLog/
├── IronLog.xcodeproj/
├── IronLog/
│   ├── App/
│   │   ├── IronLogApp.swift              # @main 入口，ModelContainer 配置
│   │   ├── AppDelegate.swift             # APNs 注册
│   │   └── RootView.swift                # 认证门控：LoginView vs MainTabView
│   │
│   ├── Core/
│   │   ├── Models/
│   │   │   ├── WorkoutSetModel.swift      # SwiftData
│   │   │   ├── ExerciseInstanceModel.swift# SwiftData
│   │   │   ├── WorkoutModel.swift         # SwiftData
│   │   │   ├── ExerciseDefModel.swift     # SwiftData
│   │   │   ├── WorkoutTemplateModel.swift # SwiftData
│   │   │   ├── SyncQueueItemModel.swift   # SwiftData（离线队列）
│   │   │   └── UserProfile.swift          # 普通 struct（非 SwiftData）
│   │   ├── DTOs/                          # Supabase 行格式 Codable 结构体
│   │   │   ├── WorkoutRow.swift
│   │   │   ├── ExerciseDefRow.swift
│   │   │   └── WorkoutTemplateRow.swift
│   │   ├── Constants.swift                # SUPABASE_URL, PRIVY_APP_ID, 常量
│   │   └── Types.swift                    # Unit, ThemeMode, ContentSource 枚举
│   │
│   ├── Services/
│   │   ├── Auth/
│   │   │   ├── PrivyAuthService.swift     # WKWebView 封装 + token 提取
│   │   │   └── TokenExchangeService.swift # POST /functions/v1/token-exchange
│   │   ├── Supabase/
│   │   │   ├── SupabaseClientProvider.swift # 单例，支持动态注入 JWT
│   │   │   ├── WorkoutRepository.swift
│   │   │   ├── ExerciseDefRepository.swift
│   │   │   ├── TemplateRepository.swift
│   │   │   └── OfficialContentRepository.swift
│   │   ├── Sync/
│   │   │   ├── SyncQueue.swift            # SwiftData 离线队列 enqueue/flush
│   │   │   └── NetworkMonitor.swift       # NWPathMonitor，替代 navigator.onLine
│   │   ├── Media/
│   │   │   ├── MediaUploadService.swift   # 上传到 Supabase Storage
│   │   │   └── MediaCacheService.swift    # SDWebImage 磁盘缓存封装
│   │   ├── Analytics/
│   │   │   ├── PRService.swift            # PR 计算（port pr.ts）
│   │   │   └── StatsService.swift         # 周训练量、负荷风险、身体部位分布
│   │   ├── NotificationService.swift      # UNUserNotificationCenter 本地通知
│   │   └── ExportService.swift            # JSON + CSV 导出 UIActivityViewController
│   │
│   ├── Store/
│   │   └── AppStore.swift                 # @Observable 全局状态（port GymContext.tsx）
│   │
│   ├── ViewModels/
│   │   ├── DashboardViewModel.swift
│   │   ├── WorkoutEditorViewModel.swift   # 草稿、自动保存、计时器、PR 检测
│   │   ├── CalendarViewModel.swift
│   │   ├── HistoryViewModel.swift
│   │   ├── StatsViewModel.swift
│   │   └── ManageViewModel.swift
│   │
│   ├── Views/
│   │   ├── Auth/
│   │   │   ├── LoginView.swift
│   │   │   └── PrivyWebAuthView.swift     # WKWebView，捕获 Privy token
│   │   ├── Main/
│   │   │   ├── MainTabView.swift          # TabView + 自定义底栏
│   │   │   └── CustomTabBar.swift         # Botanical pill 样式底部导航
│   │   ├── Dashboard/
│   │   │   ├── DashboardView.swift
│   │   │   ├── WorkoutCardView.swift
│   │   │   └── RestDayCardView.swift
│   │   ├── WorkoutEditor/
│   │   │   ├── WorkoutEditorView.swift
│   │   │   ├── ExerciseCardView.swift     # 单个练习的 sets 表
│   │   │   ├── SetRowView.swift           # 重量 + 次数 + 完成 toggle
│   │   │   ├── ExercisePickerSheet.swift  # 按分类筛选的练习选择器
│   │   │   ├── CreateExerciseSheet.swift
│   │   │   ├── EditExerciseSheet.swift
│   │   │   ├── RestTimerView.swift        # 圆形倒计时全屏遮罩
│   │   │   └── SessionReportView.swift    # 训练完成后报告 + 分享
│   │   ├── Calendar/
│   │   │   ├── CalendarView.swift
│   │   │   └── DayWorkoutListView.swift
│   │   ├── History/
│   │   │   ├── HistoryView.swift
│   │   │   └── HistoryFilterSheet.swift
│   │   ├── Stats/
│   │   │   ├── StatsView.swift
│   │   │   ├── WeeklyVolumeChart.swift    # Swift Charts BarMark
│   │   │   ├── BodyPartPieChart.swift     # Swift Charts SectorMark
│   │   │   ├── LoadRiskView.swift
│   │   │   └── OneRMTrendChart.swift      # Swift Charts LineMark
│   │   ├── Profile/
│   │   │   ├── ProfileView.swift
│   │   │   └── ProfileSettingsView.swift
│   │   ├── Manage/
│   │   │   └── ManageView.swift           # 仅管理员可见
│   │   └── Shared/
│   │       ├── BotanicalCard.swift
│   │       ├── BotanicalButton.swift      # primary / secondary / danger
│   │       ├── BotanicalTextField.swift
│   │       ├── NumberStepperField.swift   # 重量/次数步进输入
│   │       ├── CategoryPicker.swift
│   │       ├── ExerciseDetailModal.swift  # 练习进度历史详情
│   │       ├── GifVideoPlayer.swift       # AVPlayer + YouTube WKWebView
│   │       ├── ToastView.swift
│   │       ├── ConfirmDialog.swift
│   │       └── SkeletonView.swift
│   │
│   ├── DesignSystem/
│   │   ├── Color+Botanical.swift          # 颜色扩展，对应 tokens.ts
│   │   ├── Font+Botanical.swift           # Playfair Display + Source Sans 3
│   │   ├── BotanicalTheme.swift           # 动画、圆角、阴影常量
│   │   └── ViewModifiers.swift            # .botanicalCard() / .pressable()
│   │
│   ├── i18n/
│   │   ├── Localizable.xcstrings          # String Catalog（en + zh）
│   │   └── LocalizationKey.swift          # 类型安全的 key 枚举
│   │
│   └── Resources/
│       ├── Assets.xcassets/
│       │   ├── BotanicalColors/           # 每个颜色的 light/dark xcassets 文件
│       │   └── AppIcon.appiconset/
│       └── Fonts/
│           ├── PlayfairDisplay-*.ttf
│           └── SourceSans3-*.ttf
│
├── IronLogTests/
│   ├── PRServiceTests.swift
│   ├── StatsServiceTests.swift
│   ├── SyncQueueTests.swift
│   └── TokenExchangeTests.swift
│
└── IronLogUITests/
    ├── WorkoutEditorUITests.swift
    └── DashboardUITests.swift
```

---

## 二、Swift Package Manager 依赖

在 Xcode SPM 界面添加以下依赖：

| 包 | 地址 | 版本 | 用途 |
|---|---|---|---|
| `supabase-swift` | `https://github.com/supabase/supabase-swift` | `2.5.1` | Supabase REST/Storage/Realtime 客户端 |
| `SDWebImageSwiftUI` | `https://github.com/SDWebImage/SDWebImageSwiftUI` | `3.1.1` | 图片懒加载 + 磁盘缓存（替代 IndexedDB media 缓存）|
| `swift-markdown-ui` | `https://github.com/gonzalezreal/swift-markdown-ui` | `2.4.0` | 练习 Markdown 说明渲染 |
| `keychain-swift` | `https://github.com/evgenyneu/keychain-swift` | `21.0.0` | JWT + Privy token 安全存储（替代 localStorage）|
| `Reachability.swift` | `https://github.com/ashleymills/Reachability.swift` | `5.2.0` | 网络状态监听（替代 navigator.onLine）|

**注：** 不需要额外的 Privy 包。Privy 认证通过 `WKWebView` 嵌入 Web 登录流完成，提取 token 后走原有 `token-exchange` Edge Function。

系统框架直接使用（无需 SPM）：
- `SwiftUI` — UI 框架
- `SwiftData` — 本地持久化（替代 IndexedDB）
- `Charts` (Swift Charts) — 统计图表（替代 Recharts）
- `AVKit` / `AVFoundation` — 视频播放
- `WebKit` — WKWebView（Privy 登录 + YouTube embed）
- `UserNotifications` — 本地推送（替代 Web Notifications API）
- `PhotosUI` / `AVFoundation` — 媒体选择上传
- `CommonCrypto` — SHA-256（Privy DID → UUID，与 Edge Function 算法完全一致）

---

## 三、架构模式：MVVM + @Observable

**决策：MVVM + iOS 17 `@Observable` 宏**

理由：`GymContext.tsx` 的 `GymDataContext` + `GymActionsContext` 分离结构与 `@Observable` 的粒度更新行为完全对应，可 1:1 映射为 `AppStore`，无需引入 TCA 的额外复杂度。

### 核心 AppStore（替代 GymContext）

```swift
// AppStore.swift — 完整 port 自 GymContext.tsx
@Observable
final class AppStore {
    // 数据层（对应 GymDataContextType）
    var user: UserProfile?
    var workouts: [Workout] = []
    var exerciseDefs: [ExerciseDef] = []          // personal + official 合并
    var templates: [WorkoutTemplate] = []          // personal + official 合并
    var isLoading: Bool = true
    var authError: String?

    // 注入的 Service
    private let workoutRepo: WorkoutRepository
    private let exerciseRepo: ExerciseDefRepository
    private let templateRepo: TemplateRepository
    private let syncQueue: SyncQueue
    private let networkMonitor: NetworkMonitor

    // Actions（对应 GymActionsContextType 中的所有方法）
    func addWorkout(_ workout: Workout) async
    func updateWorkout(_ workout: Workout) async
    func deleteWorkout(id: String) async
    func copyWorkout(workoutId: String, targetDate: String) async
    func addExerciseDef(_ def: ExerciseDef) async
    func updateExerciseDef(_ def: ExerciseDef) async
    func deleteExerciseDef(id: String) async
    func addTemplateFromWorkout(name: String, workout: Workout) async
    func startWorkoutFromTemplate(templateId: String, targetDate: String) async -> Workout?
    func deleteTemplate(id: String) async
    func refreshOfficialContent() async
    func toggleUnit() async
    func setRestTimerSeconds(_ seconds: Int)
    func setThemeMode(_ mode: ThemeMode)
    func logout() async
}
```

**离线乐观更新模式（与 GymContext 完全一致）：**

```swift
func addWorkout(_ workout: Workout) async {
    workouts.append(workout)                          // 1. 立即更新 UI
    guard let user else { return }
    do {
        try await workoutRepo.upsert(workout, userId: user.id)  // 2. 写 Supabase
    } catch {
        if !networkMonitor.isConnected {
            await syncQueue.enqueue(...)              // 3. 离线则入队
            Toast.show("Offline: changes saved locally")
        } else {
            workouts.removeAll { $0.id == workout.id } // 4. 非网络错误则回滚
        }
    }
}
```

**注入方式：**

```swift
// IronLogApp.swift
@State private var store = AppStore()
WindowGroup { RootView().environment(store) }

// 子视图
@Environment(AppStore.self) private var store
```

---

## 四、数据层设计

### 4a. SwiftData 本地模型

SwiftData **仅用于本地离线缓存和同步队列**，Supabase 是唯一数据源。

```swift
@Model final class WorkoutModel {
    @Attribute(.unique) var id: String
    var date: String                        // "YYYY-MM-DD"，与 Web 格式完全一致
    var title: String
    var note: String
    var completed: Bool
    var elapsedSeconds: Double
    var startTimestamp: Double?             // nil = 暂停（对应 Web 的 null）
    @Relationship(deleteRule: .cascade) var exercises: [ExerciseInstanceModel] = []
    var lastModified: Date = Date()
}

@Model final class ExerciseInstanceModel {
    @Attribute(.unique) var id: String
    var defId: String
    @Relationship(deleteRule: .cascade) var sets: [WorkoutSetModel] = []
}

@Model final class WorkoutSetModel {
    @Attribute(.unique) var id: String
    var weight: Double
    var reps: Int
    var completed: Bool
}

@Model final class ExerciseDefModel {
    @Attribute(.unique) var id: String
    var name: String
    var descriptionText: String
    var source: String                      // "personal" | "official"
    var readOnly: Bool
    var category: String
    var usesBarbell: Bool
    var barbellWeight: Double
    var mediaItemsJSON: Data?               // [ExerciseMediaItem] JSON 编码
    var markdown: String?
    var thumbnailUrl: String?
    var lastModified: Date = Date()
}

@Model final class WorkoutTemplateModel {
    @Attribute(.unique) var id: String
    var name: String
    var source: String
    var readOnly: Bool
    var descriptionText: String?
    var tagline: String?
    var exercisesJSON: Data?                // [WorkoutTemplateExercise] JSON 编码
    var createdAt: String                   // ISO 8601
}

@Model final class SyncQueueItemModel {
    @Attribute(.unique) var id: String
    var userId: String
    var table: String                       // "workouts" | "exercise_defs" | "workout_templates"
    var action: String                      // "upsert" | "delete"
    var payloadJSON: Data                   // payload JSON 编码
    var timestamp: Double                   // Date.now() 等效
}
```

**ModelContainer 配置（IronLogApp.swift）：**

```swift
let schema = Schema([WorkoutModel.self, ExerciseInstanceModel.self,
                     WorkoutSetModel.self, ExerciseDefModel.self,
                     WorkoutTemplateModel.self, SyncQueueItemModel.self])
let container = try ModelContainer(for: schema,
    configurations: ModelConfiguration(isStoredInMemoryOnly: false, cloudKitDatabase: .none))
// 不使用 CloudKit！Supabase 是唯一同步层
```

### 4b. Supabase 集成

**SupabaseClientProvider.swift** — 复现 Web 端 `setAuthToken()` 的动态 JWT 注入：

```swift
final class SupabaseClientProvider {
    static let shared = SupabaseClientProvider()
    private let url = URL(string: "https://gyiqdkmvlixwgedjhycc.supabase.co")!
    private let anonKey = "sb_publishable_psIWS8xZmx4aCqVnzUFkyg_vjM1kPiz"
    private(set) var client: SupabaseClient

    func setAuthToken(_ jwt: String) {
        client = SupabaseClient(supabaseURL: url, supabaseKey: anonKey,
            options: SupabaseClientOptions(
                global: GlobalOptions(headers: ["Authorization": "Bearer \(jwt)"]),
                auth: AuthOptions(autoRefreshToken: false, persistSession: false)
            ))
    }
    func clearAuthToken() {
        client = SupabaseClient(supabaseURL: url, supabaseKey: anonKey)
    }
}
```

**Supabase 行格式（与现有 schema 100% 兼容）：**

```swift
// WorkoutRow.swift — 对应 workouts 表
struct WorkoutRow: Codable {
    let id: String
    let user_id: String
    let date: String
    let title: String
    let completed: Bool
    let data: WorkoutDataJSON      // JSONB 字段

    struct WorkoutDataJSON: Codable {
        var exercises: [ExerciseInstanceDTO]
        var note: String
        var elapsedSeconds: Double
        var startTimestamp: Double?
    }
}
```

**Realtime 订阅（对应 GymContext 中的 postgres_changes）：**

```swift
// AppStore.swift — startRealtimeSubscription()
func startRealtimeSubscription(userId: String) {
    let channel = SupabaseClientProvider.shared.client.channel("official-content-\(userId)")
    channel.onPostgresChange(InsertAction.self, table: "official_exercise_defs") { _ in
        Task { await self.refreshOfficialContent() }
    }
    channel.onPostgresChange(UpdateAction.self, table: "official_workout_templates") { _ in
        Task { await self.refreshOfficialContent() }
    }
    Task { try await channel.subscribe() }
}
```

---

## 五、认证流程（Privy iOS 实现）

**策略：WKWebView 嵌入 Privy 登录 UI + JavaScript 消息桥提取 token**

理由：Privy 目前没有成熟的 Swift 原生 SDK，WKWebView 方案最稳定，且与现有 token-exchange Edge Function 完全兼容。

```swift
// PrivyWebAuthView.swift
struct PrivyWebAuthView: UIViewRepresentable {
    let onTokenReceived: (String) -> Void   // 成功回调

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let contentController = WKUserContentController()

        // 注入 JS 桥：监听 Privy 认证完成事件，将 accessToken 传回 Swift
        let script = WKUserScript(source: """
            window.__privyCallback = function(accessToken) {
                window.webkit.messageHandlers.privyToken.postMessage(accessToken);
            };
        """, injectionTime: .atDocumentEnd, forMainFrameOnly: false)
        contentController.addUserScript(script)
        contentController.add(context.coordinator, name: "privyToken")
        config.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: config)
        // 加载一个轻量 HTML 页面，该页面初始化 PrivyProvider 并在登录后
        // 调用 window.__privyCallback(accessToken)
        webView.load(URLRequest(url: URL(string: "https://[YOUR_AUTH_PROXY]/privy-login")!))
        return webView
    }

    class Coordinator: NSObject, WKScriptMessageHandler {
        let parent: PrivyWebAuthView
        init(_ parent: PrivyWebAuthView) { self.parent = parent }
        func userContentController(_ c: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            if let token = message.body as? String {
                parent.onTokenReceived(token)
            }
        }
    }
    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
```

**TokenExchangeService.swift（与 Web 端 auth.ts 完全一致）：**

```swift
final class TokenExchangeService {
    private var cache: (token: String, expiresAt: Double, sourceToken: String)?

    func exchange(privyToken: String) async throws -> (jwt: String, userId: String) {
        // 5 分钟缓冲复用（与 Web 端 exchangePrivyToken 逻辑完全相同）
        if let c = cache, c.sourceToken == privyToken,
           Date().timeIntervalSince1970 * 1000 < c.expiresAt - 5 * 60 * 1000 {
            return (c.token, extractUserId(from: c.token))
        }

        var req = URLRequest(url: URL(string:
            "https://gyiqdkmvlixwgedjhycc.supabase.co/functions/v1/token-exchange")!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(SUPABASE_ANON_KEY)", forHTTPHeaderField: "Authorization")
        req.setValue(SUPABASE_ANON_KEY, forHTTPHeaderField: "apikey")
        req.httpBody = try JSONEncoder().encode(["token": privyToken])

        let (data, _) = try await URLSession.shared.data(for: req)
        let result = try JSONDecoder().decode(TokenResult.self, from: data)

        // 存入 Keychain（替代 Web 端 localStorage）
        KeychainSwift().set(result.token, forKey: "ironlog_supabase_jwt")
        KeychainSwift().set(result.userId, forKey: "ironlog_user_id")

        cache = (result.token, result.expiresAt, privyToken)
        return (result.token, result.userId)
    }
}
```

**Privy DID → UUID（与 Edge Function 算法完全一致，通过 CommonCrypto SHA-256）：**

```swift
func privyDidToUUID(_ did: String) -> String {
    let data = Data(did.utf8)
    var digest = [UInt8](repeating: 0, count: 32)
    data.withUnsafeBytes { CC_SHA256($0.baseAddress, CC_LONG(data.count), &digest) }
    // 设置 UUID v4 + variant 位（与 JS/Deno 实现完全相同）
    digest[6] = (digest[6] & 0x0F) | 0x40
    digest[8] = (digest[8] & 0x3F) | 0x80
    let h = digest[0..<16].map { String(format: "%02x", $0) }.joined()
    return "\(h[0..<8])-\(h[8..<12])-\(h[12..<16])-\(h[16..<20])-\(h[20..<32])"
}
```

---

## 六、导航架构

用 `NavigationStack` + `TabView` 替代 `HashRouter` + `AnimatedRoutes` + `BottomNav`。

```swift
// MainTabView.swift
struct MainTabView: View {
    @State private var selectedTab: Tab = .dashboard
    enum Tab { case dashboard, calendar, stats, profile }

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $selectedTab) {
                NavigationStack { DashboardView() }.tag(Tab.dashboard)
                NavigationStack { CalendarView() }.tag(Tab.calendar)
                NavigationStack { StatsView() }.tag(Tab.stats)
                NavigationStack { ProfileView() }.tag(Tab.profile)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .toolbar(.hidden, for: .tabBar)

            // 自定义 Botanical 底栏（含中央 FAB 新建训练）
            CustomTabBar(selectedTab: $selectedTab, onNewWorkout: {
                // NavigationPath push WorkoutEditorView(id: "new")
            })
            .padding(.horizontal, 12).padding(.bottom, 10)
        }
        .ignoresSafeArea(edges: .bottom)
    }
}
```

**路由深度对照表（Web → iOS NavigationStack）：**

| Web Route | iOS |
|---|---|
| `/` | `DashboardView`（Tab 0）|
| `/calendar` | `CalendarView`（Tab 1）|
| `/stats` | `StatsView`（Tab 2）|
| `/profile` | `ProfileView`（Tab 3）|
| `/profile/settings` | `ProfileView` → `.navigationDestination` → `ProfileSettingsView` |
| `/history` | `ProfileView` → `.navigationDestination` → `HistoryView` |
| `/workout/:id` | 任意 Tab → `.sheet` 或 `.navigationDestination` → `WorkoutEditorView` |
| `/manage` | `ProfileView` → `.navigationDestination` → `ManageView`（仅管理员）|

**手势返回**：`NavigationStack` 原生支持边缘右滑返回，无需 `useEdgeSwipeBack` hook。

---

## 七、设计系统（SwiftUI Botanical）

所有 token 来自 `src/design/tokens.ts`，逐一映射为 Swift 常量。

### 颜色（xcassets + Color 扩展）

```swift
// Color+Botanical.swift
extension Color {
    // Light: #F9F8F4 / Dark: #1F2722
    static let botanicalBackground    = Color("BotanicalBackground")
    // Light: #FFFCF8 / Dark: #2A332D
    static let botanicalSurface       = Color("BotanicalSurface")
    // Light: #DCCFC2 / Dark: #3A4840
    static let botanicalMuted         = Color("BotanicalMuted")
    // Light: #8C9A84 / Dark: #9AA992
    static let botanicalAccent        = Color("BotanicalAccent")
    // #C27B66（light/dark 相同）
    static let botanicalEmphasis      = Color("BotanicalEmphasis")
    // #6F8D73
    static let botanicalSuccess       = Color("BotanicalSuccess")
    // Light: #2D3A31 / Dark: #F6F3ED
    static let botanicalTextPrimary   = Color("BotanicalTextPrimary")
    // Light: #4F5D53 / Dark: #A8B4AA
    static let botanicalTextSecondary = Color("BotanicalTextSecondary")
    // Light: #E4DBD1 / Dark: #3E4E45
    static let botanicalBorderSubtle  = Color("BotanicalBorderSubtle")
}
```

### 字体

```swift
// Font+Botanical.swift（注册 Playfair Display + Source Sans 3）
extension Font {
    static func display(_ size: CGFloat) -> Font { .custom("PlayfairDisplay-SemiBold", size: size) }
    static func botanicalBody(_ size: CGFloat) -> Font { .custom("SourceSans3-Regular", size: size) }
    static func botanicalSemibold(_ size: CGFloat) -> Font { .custom("SourceSans3-SemiBold", size: size) }
}
```

### 动画 Token

```swift
// BotanicalTheme.swift
enum BotanicalMotion {
    static let quick    = Animation.easeOut(duration: 0.22)  // --dur-fast
    static let standard = Animation.easeOut(duration: 0.36)  // --dur-med
    static let slow     = Animation.easeOut(duration: 0.50)  // --dur-slow
    static let spring   = Animation.spring(duration: 0.36, bounce: 0.18)  // --ease-spring
}
```

### ViewModifier（卡片 + 按压效果）

```swift
// ViewModifiers.swift
struct BotanicalCardModifier: ViewModifier {
    var cornerRadius: CGFloat = 24       // tokens.radius.card
    var elevated: Bool = false

    func body(content: Content) -> some View {
        content
            .background(Color.botanicalSurface)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .shadow(color: .black.opacity(elevated ? 0.09 : 0.06),
                    radius: elevated ? 17 : 12, x: 0, y: elevated ? 7 : 4)
            .shadow(color: .black.opacity(elevated ? 0.05 : 0.04),
                    radius: elevated ? 29 : 22, x: 0, y: elevated ? 15 : 8)
    }
}

struct PressableButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeOut(duration: 0.22), value: configuration.isPressed)
    }
}

extension View {
    func botanicalCard(cornerRadius: CGFloat = 24, elevated: Bool = false) -> some View {
        modifier(BotanicalCardModifier(cornerRadius: cornerRadius, elevated: elevated))
    }
    func pressable() -> some View { buttonStyle(PressableButtonStyle()) }
}
```

---

## 八、各界面实现要点

### Dashboard
- `TabView` 横向分页模式替代 `carouselRef` + CSS `snap-x`
- 今日训练卡 + 最后完成卡 = `TabView` page 索引
- 中央 FAB 点击 → `WorkoutEditorView(workoutId: "new")`
- 操作菜单（复制/删除）用 `.confirmationDialog` 替代 `ActionMenu`

### WorkoutEditor（最复杂，1637行 port）
- **计时器**：`Timer.publish(every: 1, on: .main, in: .common)` + `@State var elapsed`
- **自动保存**：650ms debounce，用 `Task.sleep + Task.isCancelled` 替代 `setTimeout`
- **练习排序**：`List { }.onMove { }` 原生拖拽（比 Web FLIP 动画更简单）
- **休息计时器**：`.fullScreenCover` 全屏圆形倒计时
- **练习选择器**：`.sheet` 底部弹出，含分类筛选 + `LazyVStack`
- **媒体上传**：`PHPickerViewController` via `UIViewControllerRepresentable`
- **PR 徽章**：当前 set 超 PR 时显示金色徽章（对比 `brokenPRs`）
- **后台计时**：监听 `willResignActive` / `didBecomeActive` 补偿后台时间

### Calendar
- `LazyVGrid(columns: 7)` 替代 Web 自定义日历格
- `DragGesture` 阈值 50pt 切换月份（替代 `useSwipe`）
- 训练标记点：小 `Circle()` 在每日格下方

### History
- `LazyVStack` 替代 `@tanstack/react-virtual`（iOS 原生滚动自动虚拟化）
- `.swipeActions(edge: .trailing)` 替代 `SwipeableItem`

### Stats
- 全部用 Swift Charts 替代 Recharts：

| Recharts | Swift Charts |
|---|---|
| `BarChart + Bar` | `BarMark` |
| `LineChart + Line` | `LineMark` |
| `PieChart + Pie` | `SectorMark` |

- 负荷风险常量与 Web 完全相同（`elevatedRatio: 1.28`, `highRatio: 1.45`）
- 图表颜色 PIE_COLORS：`[#8C9A84, #7F9B97, #C27B66, #6F8D73, #AFBCAA, #9FB298, #D49B87]`

### Profile / Settings
- `Form + Section` 布局
- 单位切换：`.segmented` Picker（kg / lbs）
- 休息时长：Picker（30/60/90/120/180）
- 主题：Picker → 修改 `AppStore.user.preferences.themeMode` → 触发 `\.colorScheme`
- 语言：Picker → `Locale` + `Bundle.localizedBundle`
- 导出：`UIActivityViewController`
- 退出登录：确认弹窗 → `store.logout()`

---

## 九、原生功能替换表

| Web PWA 功能 | iOS 原生替换方案 |
|---|---|
| `navigator.vibrate([120, 80, 120])` | `UINotificationFeedbackGenerator().notificationOccurred(.success)` |
| Web Audio API 880Hz 提示音 | `AudioServicesPlaySystemSound(1007)` 或 `AVAudioEngine` |
| `Notification.permission` + `notifyPendingWorkout()` | `UNUserNotificationCenter` 本地推送 |
| `navigator.onLine` | `NWPathMonitor` |
| `localStorage` | `UserDefaults`（同名 key 保持兼容性） |
| `IndexedDB` (media cache) | `SDWebImage` 磁盘缓存 + Supabase Storage URL |
| `IndexedDB` (sync queue) | SwiftData `SyncQueueItemModel` |
| `navigator.share()` | `UIActivityViewController` |
| `Canvas` → PNG 分享 | `ImageRenderer` (iOS 16+) |
| `PHPhotoLibrary` | `PHPickerViewController` + `PhotosUI` |
| `navigator.standalone` | `UIApplication.shared.isRunningInFullscreen` |
| `env(safe-area-inset-*)` | `.safeAreaInsets` / `ignoresSafeArea()` |
| Service Worker 缓存 | 不需要（原生 App 无需 SW）|
| PWA Manifest | Info.plist + App Store metadata |
| HashRouter | `NavigationStack + TabView` |
| Edge swipe back hook | `NavigationStack` 原生手势（自动支持）|
| `heic2any` 转换 | iOS 原生支持 HEIC（无需转换）|

---

## 十、离线同步策略

```swift
// SyncQueue.swift — port 自 syncQueue.ts
final class SyncQueue {
    private let modelContext: ModelContext

    func enqueue(userId: String, table: String, action: String, payload: Data) async {
        let item = SyncQueueItemModel()
        item.id = UUID().uuidString
        item.userId = userId; item.table = table; item.action = action
        item.payloadJSON = payload
        item.timestamp = Date().timeIntervalSince1970 * 1000
        modelContext.insert(item)
        try? modelContext.save()
    }

    func flush(userId: String) async {
        let items = try? modelContext.fetch(
            FetchDescriptor<SyncQueueItemModel>(
                predicate: #Predicate { $0.userId == userId },
                sortBy: [SortDescriptor(\.timestamp)]    // FIFO
            )
        )
        for item in items ?? [] {
            do {
                try await executeOperation(item)
                modelContext.delete(item)
                try? modelContext.save()
            } catch {
                break  // 停在第一个失败，下次重试
            }
        }
    }
}

// NetworkMonitor.swift
@Observable final class NetworkMonitor {
    static let shared = NetworkMonitor()
    var isConnected: Bool = true
    private let monitor = NWPathMonitor()

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                let wasOffline = !(self?.isConnected ?? true)
                self?.isConnected = path.status == .satisfied
                if wasOffline && self?.isConnected == true {
                    NotificationCenter.default.post(name: .networkDidReconnect, object: nil)
                }
            }
        }
        monitor.start(queue: .global(qos: .background))
    }
}
```

---

## 十一、国际化

**使用 Xcode String Catalogs（`.xcstrings`）**，直接从现有 `src/i18n/en.json` 和 `src/i18n/zh.json` 转换。

```swift
// LocalizationKey.swift — 类型安全的 key 枚举
enum L10n {
    static func string(_ key: String, _ args: CVarArg...) -> String {
        String(format: NSLocalizedString(key, comment: ""), args)
    }
}
// 用法：L10n.string("exercises.label")
```

支持语言：`en`（英文）、`zh-Hans`（简体中文）

---

## 十二、测试策略

### 单元测试（XCTest）
- `PRServiceTests.swift` — port 自 `pr.ts` 测试逻辑（maxWeight, maxVolume, estimated1RM）
- `StatsServiceTests.swift` — 周训练量聚合、负荷风险阈值
- `SyncQueueTests.swift` — enqueue/flush、网络错误停止、FIFO 顺序
- `TokenExchangeTests.swift` — Privy DID → UUID 算法验证（与 Edge Function 输出一致）

### UI 测试（XCUITest）
- `WorkoutEditorUITests.swift` — 创建训练、添加练习、记录 set、完成训练报告
- `DashboardUITests.swift` — 卡片轮播、新建训练按钮

---

## 十三、App Store 发布准备

### Info.plist 必需条目
```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>IronLog uses photos and videos to illustrate your exercise techniques.</string>
<key>NSCameraUsageDescription</key>
<string>IronLog uses the camera to capture exercise demonstration media.</string>
<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
    <string>remote-notification</string>
</array>
<key>UIFonts</key>
<array>
    <string>PlayfairDisplay-Regular.ttf</string>
    <string>PlayfairDisplay-SemiBold.ttf</string>
    <string>PlayfairDisplay-Bold.ttf</string>
    <string>SourceSans3-Regular.ttf</string>
    <string>SourceSans3-SemiBold.ttf</string>
    <string>SourceSans3-Bold.ttf</string>
</array>
```

### Xcode Capabilities
- **Push Notifications** — 本地提醒
- **Background Modes** — Background fetch + Remote notifications（后台计时）
- **照片权限** — 练习媒体上传

### Privacy Manifest（PrivacyInfo.xcprivacy，Apple 2024 要求）
- `NSPrivacyTracking: false`
- 声明使用的 API：`NSPrivacyAccessedAPICategoryUserDefaults`（CA92.1）
- 收集的数据类型：健康/健身数据、姓名、邮件

### App Store 配置
- **Bundle ID**：`com.syntaxis.ironlog`（自定义）
- **Deployment Target**：iOS 17.0
- **设备**：iPhone only（初版）
- **分类**：Health & Fitness
- **年龄分级**：4+
- **审核备注**：说明 Privy 认证使用 WKWebView；提供测试账号

### 发布前检查清单
- [ ] 所有第三方 SDK 包含 Privacy Manifest（supabase-swift, SDWebImage, Privy）
- [ ] 无网络状态完整测试（离线队列正常工作）
- [ ] Sign in with Apple 合规性检查（Privy 提供邮件，需确认是否豁免）
- [ ] Dark Mode 所有界面验证
- [ ] Dynamic Type 所有文字缩放级别验证
- [ ] VoiceOver 所有交互元素添加 `accessibilityLabel`
- [ ] 无私有 API 使用（Instruments 检查）
- [ ] Xcode Organizer Archive + Validate 通过
- [ ] TestFlight 至少 3 台设备内测后再提交

---

## 十四、实施顺序（CodeX 执行顺序）

按以下顺序执行，避免依赖冲突：

1. **项目初始化**：创建 Xcode 项目，添加 SPM 依赖，导入字体，创建 xcassets 颜色集
2. **设计系统**：`Color+Botanical.swift`, `Font+Botanical.swift`, `ViewModifiers.swift`, `BotanicalTheme.swift`
3. **Core 类型**：所有 SwiftData Model，`Types.swift`, `Constants.swift`, DTOs
4. **Services 层**：`NetworkMonitor`, `TokenExchangeService`, `SupabaseClientProvider`, `SyncQueue`, 所有 Repository
5. **AppStore**：认证流、数据加载、离线同步（port GymContext.tsx 全部逻辑）
6. **LoginView + PrivyWebAuthView**：认证门控
7. **导航壳**：`MainTabView`, `CustomTabBar`, `RootView`
8. **Dashboard**：`DashboardView`, `WorkoutCardView`, `RestDayCardView`
9. **WorkoutEditor**：`WorkoutEditorViewModel` + 所有子视图 + `RestTimerView` + `SessionReportView`
10. **练习系统**：`ExercisePickerSheet`, `CreateExerciseSheet`, `EditExerciseSheet`, `ExerciseDetailModal`, `GifVideoPlayer`
11. **Calendar**：`CalendarView`, `DayWorkoutListView`
12. **History**：`HistoryView`, `HistoryFilterSheet`
13. **Stats**：`StatsView` + 所有图表子视图 + `StatsService`
14. **Profile**：`ProfileView`, `ProfileSettingsView`, `ExportService`, `NotificationService`
15. **Manage**：`ManageView`（仅管理员）
16. **i18n**：`Localizable.xcstrings` 从 `en.json`/`zh.json` 完整转换
17. **单元测试**：`PRServiceTests`, `StatsServiceTests`, `SyncQueueTests`, `TokenExchangeTests`
18. **UI 测试**：Dashboard + WorkoutEditor 流程
19. **App Store 准备**：Privacy Manifest, Info.plist, 截图, 元数据, TestFlight

---

## 关键文件参考（现有 PWA 源码）

| 文件 | Port 目标 | 重要性 |
|---|---|---|
| `src/context/GymContext.tsx` | `AppStore.swift` | ⭐⭐⭐ 最高优先级，所有状态逻辑来源 |
| `src/views/WorkoutEditor.tsx` | `WorkoutEditorView.swift` + `WorkoutEditorViewModel.swift` | ⭐⭐⭐ 最复杂界面 |
| `supabase/functions/token-exchange/index.ts` | `TokenExchangeService.swift` | ⭐⭐⭐ 认证协议必须完全兼容 |
| `src/design/tokens.ts` | `BotanicalTheme.swift` + xcassets | ⭐⭐ 设计系统来源 |
| `src/services/syncQueue.ts` | `SyncQueue.swift` | ⭐⭐ 离线同步来源 |
| `src/types.ts` | `Core/Models/*.swift` + DTOs | ⭐⭐ 数据模型来源 |
| `src/services/pr.ts` | `PRService.swift` | ⭐ PR 计算算法 |
| `src/views/StatsView.tsx` | `StatsView.swift` + `StatsService.swift` | ⭐ 图表逻辑 |
| `src/i18n/en.json`, `zh.json` | `Localizable.xcstrings` | ⭐ 多语言 |
| `supabase/migrations/*.sql` | （只读参考，不修改）| ⭐⭐⭐ Schema 兼容性 |
