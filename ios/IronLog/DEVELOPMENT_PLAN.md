# IronLog iOS App 完善开发文档

> 本文档基于对 IronLog iOS 项目的完整代码审查，覆盖 89 个 Swift 文件（7,111 行代码），对比 PWA 版本后整理出所有需要修复和完善的工作项。

---

## 目录

1. [项目概览](#1-项目概览)
2. [设计系统完善](#2-设计系统完善)
3. [UI 动画缺失修复](#3-ui-动画缺失修复)
4. [原生 Apple UI 替换为 Botanical 主题](#4-原生-apple-ui-替换为-botanical-主题)
5. [样式一致性修复](#5-样式一致性修复)
6. [功能不完善 / 未完成](#6-功能不完善--未完成)
7. [缺失的 UX 模式](#7-缺失的-ux-模式)
8. [与 PWA 功能差距](#8-与-pwa-功能差距)
9. [服务层与数据层问题](#9-服务层与数据层问题)
10. [无障碍访问修复](#10-无障碍访问修复)
11. [优先级排序与开发顺序](#11-优先级排序与开发顺序)

---

## 1. 项目概览

| 项目 | 值 |
|------|-----|
| App 名称 | IronLog |
| Bundle ID | com.syntaxis.ironlog |
| 最低 iOS 版本 | 17.0 |
| 架构模式 | MVVM + @Observable |
| 数据持久化 | SwiftData + Supabase |
| 设计系统 | Botanical Theme（自定义） |
| 字体 | PlayfairDisplay-SemiBold / SourceSans3 |
| 主要依赖 | Supabase, SDWebImageSwiftUI, MarkdownUI, KeychainSwift, Privy |

### 当前架构

```
App/          → 入口、RootView
Core/         → SwiftData Models, DTOs, Types, Constants
DesignSystem/ → BotanicalTheme, Color, Font, ViewModifiers
Services/     → Auth, Analytics, Media, Supabase, Sync
Store/        → AppStore（中央状态容器）
ViewModels/   → 各页面 ViewModel
Views/        → SwiftUI 视图（按功能分目录）
```

---

## 2. 设计系统完善

### 2.1 新增主题颜色

当前 Botanical 主题只有 9 种语义颜色，缺少以下关键状态色：

| 需要新增的颜色 | 用途 | 当前硬编码位置 |
|---------------|------|--------------|
| `BotanicalDanger` | 危险/删除操作背景 | `BotanicalButton.swift:34` 硬编码 `Color(red: 0.72, green: 0.32, blue: 0.28)` |
| `BotanicalDangerLight` | 危险操作浅色背景 | `BotanicalButton.swift:42` 硬编码 `Color(red: 0.98, green: 0.93, blue: 0.91)` |
| `BotanicalWarning` | 警告状态 | `LoadRiskView.swift` 硬编码 `Color(hex: "EF4444")` |
| `BotanicalInfo` | 信息提示 | `LoadRiskView.swift` 硬编码 `Color(hex: "38BDF8")` |
| `BotanicalOverlay` | 遮罩/覆盖层 | `ExerciseDetailModal.swift:262` 硬编码 `.black.opacity(0.55)` |

**操作**：在 `Assets.xcassets` 中新增以上颜色集，在 `Color+Botanical.swift` 中添加对应扩展。

### 2.2 图表配色系统化

`BodyPartPieChart.swift:7-15` 中使用硬编码 hex 色值：

```swift
// 当前 - 硬编码
Color(hex: "8C9A84"), Color(hex: "7F9B97"), Color(hex: "C27B66"), ...
```

**操作**：在 `BotanicalTheme.swift` 中定义 `chartPalette: [Color]` 数组，所有图表统一引用。

### 2.3 新增共享组件

以下组件在多处重复实现或缺失，需统一提取到 `DesignSystem/` 或 `Views/Shared/`：

| 组件 | 说明 | 涉及文件 |
|------|------|---------|
| `BotanicalToggle` | 统一的开关组件 | `ProfileSettingsView.swift` 中有局部实现（Line 155-172），但未提取为独立组件 |
| `BotanicalPicker` | 替代 `.segmented` pickerStyle | `ManageView.swift:42` 使用原生 segmented |
| `BotanicalForm` | 替代原生 `Form` 的卡片式表单 | `EditExerciseSheet.swift:26` 使用原生 Form |
| `BotanicalSearchField` | 统一的搜索输入框 | `HistoryView.swift:35`、`HistoryFilterSheet.swift:15` 各自实现 |
| `EmptyStateView` | 统一的空状态组件（图标+文字+操作） | 多处各自实现简单文本 |
| `LoadingStateView` | 统一的加载状态组件 | 多处缺失加载状态 |
| `ErrorStateView` | 统一的错误状态组件（重试按钮） | 多处错误处理不一致 |

---

## 3. UI 动画缺失修复

### 3.1 页面/Sheet 过渡动画

| 位置 | 问题 | 修复方案 |
|------|------|---------|
| `ManageView.swift:42-46` | Tab 切换无过渡动画 | 添加 `.animation(BotanicalMotion.standard, value: selectedTab)` + `.transition(.opacity)` |
| `DashboardView.swift:56-100` | 模板选择 Sheet 中 List 项无进入动画 | 使用 `.transition(.move(edge: .bottom).combined(with: .opacity))` |
| `WorkoutEditorView.swift:68` | 关闭 Sheet 后用 `DispatchQueue.main.asyncAfter(deadline: .now() + 0.2)` 硬编码延迟 | 替换为 `withAnimation(BotanicalMotion.standard) {}` |
| `ExercisePickerSheet.swift` | 搜索结果列表无动画过渡 | 添加 `.animation(BotanicalMotion.quick, value: filteredExercises)` |

### 3.2 交互反馈动画

| 位置 | 问题 | 修复方案 |
|------|------|---------|
| `CategoryPicker.swift:7-13` | Menu 选择无动画反馈 | 添加选中状态变化动画 |
| `NumberStepperField.swift:8-14` | 加减按钮无按压动画、数值变化无动画 | 添加 `.scaleEffect` 按压动画 + 数值变化的 `.contentTransition(.numericText())` |
| `HistoryFilterSheet.swift:42-52` | 筛选按钮点击无动画反馈 | 添加 `withAnimation(BotanicalMotion.quick)` |
| `SetRowView.swift:38-57` | 完成勾选动画缺失（仅颜色切换） | 添加 checkmark 出现的 `.transition(.scale.combined(with: .opacity))` |
| `BotanicalButton.swift` | 仅有 opacity 变化，缺少按压缩放 | 添加 `.scaleEffect(isPressed ? 0.97 : 1.0)` |

### 3.3 列表项动画

| 位置 | 问题 | 修复方案 |
|------|------|---------|
| `HistoryView.swift` | 历史记录列表无进入动画 | 添加每个卡片的延迟出现动画 |
| `StatsView.swift` | 图表卡片无进入动画 | 添加 `.onAppear` 驱动的 staggered 动画 |
| `DashboardView.swift` | 训练卡片列表无加载动画 | 添加 `.transition(.asymmetric(...))` |
| `ExerciseCardView.swift` | 添加/移除 set 无列表动画 | 使用 `withAnimation { }` 包裹 add/remove 操作 |

### 3.4 导航与页面切换

| 位置 | 问题 | 修复方案 |
|------|------|---------|
| `MainTabView.swift` / `CustomTabBar.swift` | Tab 切换内容区无过渡动画 | 添加 `.transition(.opacity)` + `.animation(.easeInOut(duration: 0.2), value: selectedTab)` |
| `CalendarView.swift` | 月份切换无滑动动画 | 添加左右滑动的 `.transition(.move(edge:))` |

---

## 4. 原生 Apple UI 替换为 Botanical 主题

### 4.1 高优先级替换

#### `ManageView.swift` — 全文件需要重构

**当前问题**：

- Line 42: 使用 `.pickerStyle(.segmented)` — 原生 Apple 分段控件
- Line 46-110: 使用 `.listStyle(.insetGrouped)` — 原生 Apple 列表样式
- Line 59, 92: 原生 `TextField` 无 Botanical 样式
- Line 60, 93: 按钮文本为 "Save Placeholder" — 占位符未实现

**修复方案**：

```swift
// 替换 Picker 为自定义 Tab 切换
HStack(spacing: 0) {
    ForEach(tabs, id: \.self) { tab in
        Button(tab.title) { selectedTab = tab }
            .botanicalTabStyle(isSelected: selectedTab == tab)
    }
}

// 替换 List 为 ScrollView + LazyVStack + BotanicalCard
ScrollView {
    LazyVStack(spacing: 12) {
        ForEach(items) { item in
            BotanicalCard { /* card content */ }
        }
    }
    .padding(.horizontal, BotanicalTheme.pagePadding)
}

// 使用 BotanicalTextField 替换原生 TextField
BotanicalTextField("Exercise Name", text: $name)
```

#### `EditExerciseSheet.swift` — Form 替换

**当前问题**：

- Line 26: 使用原生 `Form { }` — Apple 默认表单
- Line 28-29: 原生 TextField
- Line 34-36: 原生 Picker
- Line 40: 原生 Toggle 仅覆盖 `.tint()`

**修复方案**：替换 `Form` 为 `ScrollView` + `VStack` + `BotanicalCard` 布局，所有表单控件使用 Botanical 组件。

#### `ProfileSettingsView.swift` — Toggle 不一致

**当前问题**：

- Line 50-54: 通知 Toggle 使用原生 Apple Toggle
- Line 155-172: 同文件内有自定义 `botanicalToggle`，但未统一使用

**修复方案**：将 Line 155-172 的 `botanicalToggle` 提取为独立 `BotanicalToggle` 组件，全文件统一调用。

### 4.2 中优先级替换

| 文件 | 问题 | 修复 |
|------|------|------|
| `HistoryView.swift:35` | `TextField` 使用 `.textFieldStyle(.plain)` | 替换为 `BotanicalSearchField` |
| `HistoryFilterSheet.swift:15` | 同上 | 替换为 `BotanicalSearchField` |
| `NumberStepperField.swift:8-14` | 使用 `.roundedBorder` textFieldStyle | 重写为 Botanical 风格的 stepper |
| `DashboardView.swift:80` | 模板选择使用 `.insetGrouped` listStyle | 替换为 `ScrollView` + `BotanicalCard` |
| `WorkoutEditorView.swift:195-284` | 使用 `.listStyle(.plain)` + `.scrollContentBackground(.hidden)` | 考虑替换为 `ScrollView` + `LazyVStack` 以完全控制样式 |

---

## 5. 样式一致性修复

### 5.1 硬编码颜色

| 文件:行 | 当前代码 | 修复为 |
|---------|---------|--------|
| `BodyPartPieChart.swift:7-15` | `Color(hex: "8C9A84")` 等 7 个色值 | `BotanicalTheme.chartPalette[index]` |
| `LoadRiskView.swift:11` | `Color(hex: "EF4444")` | `.botanicalDanger` |
| `LoadRiskView.swift:15` | `Color(hex: "38BDF8")` | `.botanicalInfo` |
| `HistoryView.swift:92-96` | `Color.red` | `.botanicalDanger` |
| `BotanicalButton.swift:34` | `Color(red: 0.98, green: 0.93, blue: 0.91)` | `.botanicalDangerLight` |
| `BotanicalButton.swift:42` | `Color(red: 0.72, green: 0.32, blue: 0.28)` | `.botanicalDanger` |
| `ProfileSettingsView.swift:161` | `.white` 用于 Toggle 圆形 | `.botanicalSurface` |
| `ExerciseDetailModal.swift:262` | `.black.opacity(0.55)` | `.botanicalOverlay` |

### 5.2 硬编码字体

| 文件:行 | 当前代码 | 修复为 |
|---------|---------|--------|
| `SetRowView.swift:84-85` | `.system(size: 12, weight: .semibold)` | `.botanicalSemibold(12)` |
| `WorkoutEditorView.swift:202` | `.display(34)` 硬编码尺寸 | 考虑使用 `BotanicalTheme` 中定义的尺寸常量 |

### 5.3 Emoji 替换为 SF Symbols

| 文件:行 | 当前 Emoji | 替换为 SF Symbol |
|---------|-----------|-----------------|
| `SessionReportView.swift:62` | "🏆" | `Image(systemName: "trophy.fill")` |
| `SessionReportView.swift:131` | "⏱" | `Image(systemName: "timer")` |
| `SessionReportView.swift:132` | "✓" | `Image(systemName: "checkmark.circle.fill")` |
| `SessionReportView.swift:133` | "🏋️" | `Image(systemName: "dumbbell.fill")` |
| `EditExerciseSheet.swift:59` | "Media Uploaded ✓" | `Label("Media Uploaded", systemImage: "checkmark.circle.fill")` |

---

## 6. 功能不完善 / 未完成

### 6.1 ManageView 占位符按钮

**文件**: `ManageView.swift`
**问题**: Line 60 和 Line 93 存在 "Save Placeholder" 占位文本按钮

**修复方案**：
- 实现完整的练习创建/编辑保存逻辑（调用 `ExerciseDefRepository`）
- 实现完整的模板创建/编辑保存逻辑（调用 `TemplateRepository`）
- 保存后显示成功 Toast、关闭编辑状态

### 6.2 计时器计算 Bug

**文件**: `WorkoutEditorViewModel.swift:127`
**问题**: 运算符优先级错误

```swift
// 当前代码 - 错误
let extra = Date().timeIntervalSince1970 - start / 1000

// 修复
let extra = (Date().timeIntervalSince1970 * 1000 - start) / 1000
```

**影响**: 恢复训练时计时器显示不正确。

### 6.3 主题持久化不完整

**文件**: `AppStore.swift:638-646`
**问题**: `restoreThemeFromGlobal()` 恢复了主题模式但未同步到 `user.preferences.themeMode`
**影响**: 主题设置跨会话不持久化。

### 6.4 isLoading 状态可能卡住

**文件**: `AppStore.swift:147-148`
**问题**: `refreshData()` 中设置 `isLoading = true` 但在错误路径中未重置
**影响**: 如果刷新失败，UI 可能永久停留在加载状态。

**修复**：添加 `defer { isLoading = false }` 或在 catch 块中重置。

### 6.5 网络状态初始化不准

**文件**: `NetworkMonitor.swift:9`
**问题**: `isConnected` 初始值为 `true`，但 app 可能在离线状态启动
**影响**: 冷启动时离线操作不会正确入队。

**修复**：初始化时查询当前网络状态或设初始值为 `false`。

---

## 7. 缺失的 UX 模式

### 7.1 加载状态（Loading States）

以下页面/操作缺少加载指示器：

| 场景 | 文件 | 修复方案 |
|------|------|---------|
| 练习列表加载 | `ExercisePickerSheet.swift` | 搜索/过滤时显示 `SkeletonView` 或 `ProgressView` |
| 统计数据计算 | `StatsView.swift` | 图表区域显示骨架屏 |
| 训练保存到后端 | `WorkoutEditorView.swift` | 保存按钮显示 loading spinner |
| 数据刷新 | `DashboardView.swift` | 全局刷新时显示顶部 loading bar |
| 历史记录加载 | `HistoryView.swift` | 首次加载时显示骨架屏 |

> 项目中已有 `SkeletonView.swift`，但几乎没有被实际使用。

### 7.2 空状态（Empty States）

| 位置 | 当前状态 | 需要增强 |
|------|---------|---------|
| `HistoryView.swift:51-57` | 纯文字 "No workouts found" | 添加插图 + SF Symbol + 引导操作按钮 |
| `DayWorkoutListView.swift:11-21` | 简单文本 | 添加 "开始训练" 按钮 |
| `StatsView.swift:150-163` | 有图标但样式简单 | 增强为完整的空状态卡片 |
| `ManageView.swift` | 无空状态 | 添加 "创建第一个练习/模板" 引导 |
| `CalendarView.swift` | 未检查 | 添加无训练月份的提示 |

**建议**：创建统一 `EmptyStateView(icon:title:description:action:)` 组件。

### 7.3 错误状态（Error States）

| 位置 | 当前处理 | 需要增强 |
|------|---------|---------|
| `CreateExerciseSheet.swift:123-127` | 仅显示文字错误 | 使用 Botanical 风格错误卡片 + 重试按钮 |
| `EditExerciseSheet.swift:71-75` | 同上 | 同上 |
| 网络请求失败 | Toast 提示 | 添加内联错误卡片 + 重试机制 |
| 训练同步失败 | 静默失败 | 显示同步失败标记 + 手动重试 |

### 7.4 下拉刷新（Pull-to-Refresh）

以下页面缺少 `.refreshable` 修饰符：

- `DashboardView.swift` — 刷新训练列表
- `HistoryView.swift` — 刷新历史记录
- `StatsView.swift` — 重新计算统计
- `CalendarView.swift` — 刷新日历数据
- `ManageView.swift` — 刷新练习/模板列表

**操作**：在每个页面的 `ScrollView` 或 `List` 上添加 `.refreshable { await store.refreshData() }`

### 7.5 触觉反馈（Haptic Feedback）

当前仅 `SetRowView.swift`（Line 40, 162）和 `RestTimerView.swift`（Line 70, 94, 99）有触觉反馈，以下场景需要添加：

| 场景 | 类型 |
|------|------|
| Tab 切换 | `.selection` |
| 按钮点击 | `.light` |
| 训练完成 | `.success` |
| 删除确认 | `.warning` |
| 错误提示 | `.error` |
| 筛选器选择 | `.selection` |
| Stepper 加减 | `.light` |
| 训练卡片长按 | `.medium` |

**建议**：创建 `HapticManager` 单例统一管理触觉反馈。

### 7.6 键盘处理

- 数字输入（体重、次数）缺少 `.keyboardType(.decimalPad)` 和自定义工具栏（完成按钮）
- 搜索框缺少 `.submitLabel(.search)` 和 `.onSubmit` 处理
- 表单页面缺少键盘避让处理

---

## 8. 与 PWA 功能差距

### 8.1 高级历史筛选

**PWA 有，iOS 缺失**

PWA 的 HistoryView 支持 5 维度筛选：
1. 训练名称搜索
2. 按年份筛选
3. 按月份筛选
4. 按身体部位筛选
5. 按完成状态筛选（完成/进行中）

iOS 的 `HistoryFilterSheet.swift` 仅有基础搜索。

**修复方案**：
- 重构 `HistoryFilterSheet.swift`，添加年/月 Picker、身体部位多选、完成状态 Toggle
- 在 `HistoryView.swift` 添加 Filter Chips 显示当前激活的筛选条件
- 支持单击 Chip 移除单个筛选

### 8.2 训练卡片轮播（Carousel）

**PWA 有，iOS 缺失**

PWA Dashboard 使用自定义轮播展示训练卡片，支持：
- Snap 滚动
- 页面指示器（X/Y）
- 手动滑动检测

**修复方案**：
- 在 `DashboardView.swift` 中使用 `TabView` with `.tabViewStyle(.page)` 或自定义 `ScrollView` + `scrollTargetBehavior(.paging)` 实现轮播
- 添加页面指示器

### 8.3 练习拖拽重排序

**PWA 有，iOS 不确定是否完整**

PWA 的 WorkoutEditor 支持长按拖拽重新排列练习顺序。

**修复方案**：
- 在 `WorkoutEditorView.swift` 的练习列表中添加 `.onMove(perform:)` 或自定义 `DragGesture` 实现
- 添加拖拽手柄 UI
- 拖拽时添加 haptic feedback

### 8.4 负荷风险分析增强

**PWA 更完整，iOS 基础版**

PWA 的 LoadRiskView 有：
- 5 级风险等级（不足/低/正常/升高/高）
- 上下文建议文字
- 急性 vs 基线对比
- 柱状图 + 折线图组合图表

iOS 的 `LoadRiskView.swift` 和 `StatsView.swift` 功能较基础。

**修复方案**：
- 增强 `LoadRiskView.swift` 的风险等级显示
- 添加每个等级的建议文字
- 实现急性/基线对比柱状+折线组合图表

### 8.5 日历月份滑动切换

**PWA 有手势切换，iOS 需确认**

PWA 使用自定义 swipe hook 实现左右滑动切换月份。

**修复方案**：
- 在 `CalendarView.swift` 中添加 `DragGesture` 识别水平滑动
- 滑动方向决定上/下月
- 配合 `.transition(.move(edge:))` 实现滑入滑出动画

### 8.6 Markdown 练习描述

**PWA 有，iOS 基础**

PWA 练习定义支持 Markdown 格式描述和内嵌 YouTube 视频。项目已依赖 `MarkdownUI`，但未充分使用。

**修复方案**：
- 在 `ExerciseDetailModal.swift` 中使用 `MarkdownUI` 渲染练习描述
- 支持 YouTube 链接识别和内嵌播放

---

## 9. 服务层与数据层问题

### 9.1 错误处理

| 文件 | 问题 | 修复 |
|------|------|------|
| `NotificationService.swift:24` | `try?` 静默忽略通知调度失败 | 改为 `do/catch` + 日志记录 |
| `ExportService.swift:14,16,44` | `try?` 文件操作静默失败 | 添加错误处理，导出失败时通知用户 |
| `SyncQueue.swift:50-56` | 所有错误被 `catch { break }` 吞掉 | 分类错误处理：网络错误 → 重试，数据错误 → 日志 |
| `TokenExchangeService.swift:108-122` | `extractUserId()` 解码失败返回空字符串 | 返回 Optional 或 throw，上游处理 |
| `MediaUploadService.swift:21` | 上传失败无重试机制 | 添加重试逻辑（指数退避） |

### 9.2 同步与离线问题

#### A. 同步队列幂等性缺失

**文件**: `SyncQueue.swift:42-57`
**问题**: 无幂等键，重复执行可能产生重复数据
**修复**: 添加 idempotency key 到 `SyncQueueItemModel`，服务端检查去重

#### B. 离线操作竞态条件

**文件**: `AppStore.swift:218-230`
**问题**: `updateWorkout` 中的异步操作期间网络状态可能变化

```swift
// 问题代码模式
let previous = workouts
workouts = workouts.map { ... } // 乐观更新
do {
    try await repo.update(...)  // 异步操作
} catch {
    if networkMonitor.isConnected { // 此时网络状态可能已变
        workouts = previous  // 回滚
    } else {
        await queueOfflineOperation(...)
    }
}
```

**修复**: 根据错误类型而非网络状态判断 — 网络错误入队，服务端错误回滚并提示。

#### C. 非网络错误导致操作丢失

**文件**: `AppStore.swift:284-286`
**问题**: 网络已连接但请求失败（如 500 错误）时操作丢失
**修复**: 对服务端 5xx 错误也入队重试

#### D. 空 userId 问题

**文件**: `AppStore.swift:578`
**问题**: `row.user_id ?? user?.id ?? ""` 可能产生空 userId 的同步记录
**修复**: userId 为空时不入队，打日志警告

### 9.3 数据查询性能

| 文件 | 问题 | 修复 |
|------|------|------|
| `WorkoutRepository.swift:11-15` | `fetchWorkouts()` 无分页，获取全部数据 | 添加分页：`.range(from: offset, to: offset + limit)` |
| `ExerciseDefRepository.swift:11-15` | `fetchPersonal()` 无分页 | 同上 |
| `TemplateRepository.swift:11-16` | `fetchPersonal()` 和 `fetchOfficial()` 无分页 | 同上 |
| `OfficialContentRepository.swift:12-16` | 每次都发网络请求，无缓存 | 添加内存缓存 + TTL（如 1 小时） |

### 9.4 数据模型缺失字段

| 模型 | 缺失字段 | 影响 |
|------|---------|------|
| `WorkoutSet` (Types.swift:37-42) | RPE（自觉运动强度）、单组备注、组前休息时间 | 限制训练分析和回顾 |
| `ExerciseInstance` (Types.swift:44-48) | 显式排序字段 | 并发编辑时顺序不稳定 |
| `UserProfile` (Types.swift:107-115) | 创建日期、最后登录、订阅信息 | 无法实现分析或高级功能 |

### 9.5 日志系统缺失

**当前状态**: 无任何日志框架，所有错误静默处理。

**建议**：
- 使用 Apple 的 `os.Logger` 添加分类日志
- 关键操作（同步、认证、数据写入）添加日志
- 可选：集成远程日志服务用于生产调试

---

## 10. 无障碍访问修复

### 10.1 缺失 Accessibility Labels

| 文件 | 元素 | 修复 |
|------|------|------|
| `CustomTabBar.swift:9-24` | Tab 按钮 | 添加 `.accessibilityLabel("Dashboard"/"Calendar"/"Stats"/"Profile")` |
| `SetRowView.swift:38-57` | 完成勾选框 | 添加 `.accessibilityLabel("Mark set as completed")` + `.accessibilityAddTraits(.isButton)` |
| `HistoryView.swift:88-96` | 删除按钮 | 添加 `.accessibilityLabel("Delete workout")` |
| `RestTimerView.swift:54-66` | 时长选择按钮 | 添加 `.accessibilityLabel("Set timer to X seconds")` |
| `CategoryPicker.swift:7-13` | Menu Picker | 添加 `.accessibilityLabel("Select body part category")` |
| `ExercisePickerSheet.swift:107-124` | Info 和 Add 按钮 | 添加 `.accessibilityLabel("Exercise info"/"Add exercise")` |
| `DayWorkoutListView.swift:80-87` | 更多菜单按钮 | 添加 `.accessibilityLabel("Workout options")` |
| `ExerciseCardView.swift:36-47` | 移除按钮 | 添加 `.accessibilityLabel("Remove exercise")` |

### 10.2 点击区域过小

Apple HIG 建议最小点击目标为 44x44pt。

| 文件 | 元素 | 当前尺寸 | 修复 |
|------|------|---------|------|
| `ExerciseCardView.swift:36-47` | 移除按钮 | 24x24 | 增加到 44x44（扩大 padding 或 `.contentShape`） |
| `SetRowView.swift:38-57` | 完成圆圈 | 34x34 | 增加到 44x44 |
| `RestTimerView.swift:54-66` | 时长按钮 | padding 12/6 | 增加垂直 padding 至 12 |
| `HistoryView.swift:88-96` | 删除按钮 | 42x42 | 增加到 44x44 |

### 10.3 仅靠颜色区分的状态

| 位置 | 问题 | 修复 |
|------|------|------|
| `SetRowView.swift:38-57` | 完成状态仅通过圆圈颜色和勾号区分 | 为 VoiceOver 添加状态描述 `.accessibilityValue(isCompleted ? "Completed" : "Not completed")` |
| `DayWorkoutListView.swift:96-110` | 状态仅通过 badge 颜色区分 | 添加 `.accessibilityLabel` 包含状态文字 |
| `LoadRiskView.swift:66-72` | 风险等级仅靠颜色 | 添加 `.accessibilityLabel` 包含风险等级文字 |

---

## 11. 优先级排序与开发顺序

### P0 — 关键修复（影响功能正确性）

| # | 任务 | 文件 | 预估工作量 |
|---|------|------|-----------|
| 1 | 修复计时器运算符优先级 Bug | `WorkoutEditorViewModel.swift:127` | 5 分钟 |
| 2 | 修复 isLoading 状态可能卡住 | `AppStore.swift:147-148` | 10 分钟 |
| 3 | 修复网络状态初始化 | `NetworkMonitor.swift:9` | 15 分钟 |
| 4 | 修复空 userId 入队同步 | `AppStore.swift:578` | 15 分钟 |
| 5 | 修复主题持久化不完整 | `AppStore.swift:638-646` | 20 分钟 |
| 6 | 完成 ManageView 占位按钮功能 | `ManageView.swift:60,93` | 1-2 小时 |

### P1 — 设计系统统一（视觉一致性）

| # | 任务 | 涉及文件 | 预估工作量 |
|---|------|---------|-----------|
| 7 | 新增主题颜色（Danger/Warning/Info/Overlay） | `Color+Botanical.swift`, `Assets.xcassets` | 30 分钟 |
| 8 | 新增图表配色数组 | `BotanicalTheme.swift` | 15 分钟 |
| 9 | 创建 BotanicalToggle 组件 | 新文件 `Views/Shared/BotanicalToggle.swift` | 30 分钟 |
| 10 | 创建 BotanicalSearchField 组件 | 新文件 `Views/Shared/BotanicalSearchField.swift` | 30 分钟 |
| 11 | 创建 BotanicalSegmentedControl 组件 | 新文件 `Views/Shared/BotanicalSegmentedControl.swift` | 45 分钟 |
| 12 | 创建 EmptyStateView 组件 | 新文件 `Views/Shared/EmptyStateView.swift` | 30 分钟 |
| 13 | 替换所有硬编码颜色 | 见第5节表格 | 30 分钟 |
| 14 | 替换所有 Emoji 为 SF Symbols | 见第5.3节 | 15 分钟 |

### P2 — 原生 UI 替换（消除 Apple 默认外观）

| # | 任务 | 涉及文件 | 预估工作量 |
|---|------|---------|-----------|
| 15 | 重构 ManageView 移除原生 List/Form/Picker | `ManageView.swift` | 2-3 小时 |
| 16 | 重构 EditExerciseSheet 移除原生 Form | `EditExerciseSheet.swift` | 1-2 小时 |
| 17 | 统一 ProfileSettingsView Toggle | `ProfileSettingsView.swift` | 30 分钟 |
| 18 | 替换所有原生 TextField 为 Botanical 版 | 多个文件 | 1 小时 |
| 19 | 替换 DashboardView 模板选择列表样式 | `DashboardView.swift` | 45 分钟 |
| 20 | 替换 NumberStepperField 样式 | `NumberStepperField.swift` | 45 分钟 |

### P3 — 动画与交互（流畅体验）

| # | 任务 | 涉及文件 | 预估工作量 |
|---|------|---------|-----------|
| 21 | 添加 Tab 切换过渡动画 | `MainTabView.swift`, `CustomTabBar.swift` | 30 分钟 |
| 22 | 添加日历月份滑动切换动画 | `CalendarView.swift` | 1 小时 |
| 23 | 添加列表项 staggered 出现动画 | `HistoryView`, `StatsView`, `DashboardView` | 1-2 小时 |
| 24 | 添加按钮按压动画 | `BotanicalButton.swift` 等 | 30 分钟 |
| 25 | 添加 Set 完成勾选动画 | `SetRowView.swift` | 30 分钟 |
| 26 | 添加 Stepper 数值变化动画 | `NumberStepperField.swift` | 20 分钟 |
| 27 | 创建 HapticManager + 全局触觉反馈 | 新文件 + 多处调用 | 1-2 小时 |

### P4 — UX 增强（用户体验）

| # | 任务 | 涉及文件 | 预估工作量 |
|---|------|---------|-----------|
| 28 | 添加下拉刷新到所有主页面 | 5 个 View 文件 | 30 分钟 |
| 29 | 使用 SkeletonView 添加加载状态 | 多个 View 文件 | 1-2 小时 |
| 30 | 增强所有空状态（图标+描述+操作） | 5+ 个 View 文件 | 1-2 小时 |
| 31 | 增强错误状态（Botanical 卡片+重试） | 多处 | 1-2 小时 |
| 32 | 键盘优化（类型+工具栏+避让） | 表单相关 View | 1 小时 |

### P5 — PWA 功能对齐

| # | 任务 | 涉及文件 | 预估工作量 |
|---|------|---------|-----------|
| 33 | 高级历史筛选（年/月/部位/状态） | `HistoryFilterSheet.swift`, `HistoryView.swift`, `HistoryViewModel.swift` | 3-4 小时 |
| 34 | Dashboard 训练卡片轮播 | `DashboardView.swift` | 2-3 小时 |
| 35 | 练习拖拽重排序 | `WorkoutEditorView.swift` | 2-3 小时 |
| 36 | 负荷风险分析增强 | `LoadRiskView.swift`, `StatsView.swift`, `StatsService.swift` | 3-4 小时 |
| 37 | Markdown 练习描述渲染 | `ExerciseDetailModal.swift` | 1-2 小时 |

### P6 — 服务层健壮性

| # | 任务 | 涉及文件 | 预估工作量 |
|---|------|---------|-----------|
| 38 | 修复错误处理（5 处 try? 替换） | 多个 Service 文件 | 1-2 小时 |
| 39 | 同步队列幂等性 | `SyncQueue.swift`, `SyncQueueItemModel.swift` | 2-3 小时 |
| 40 | 离线操作竞态条件修复 | `AppStore.swift` | 2-3 小时 |
| 41 | Repository 分页查询 | 4 个 Repository 文件 | 2-3 小时 |
| 42 | 官方内容缓存 | `OfficialContentRepository.swift` | 1 小时 |
| 43 | 添加 os.Logger 日志系统 | 全项目 | 2-3 小时 |

### P7 — 无障碍

| # | 任务 | 涉及文件 | 预估工作量 |
|---|------|---------|-----------|
| 44 | 添加所有缺失的 accessibilityLabel | 8+ 个 View 文件 | 1-2 小时 |
| 45 | 修复小于 44x44 的点击区域 | 4 个 View 文件 | 30 分钟 |
| 46 | 修复仅靠颜色区分的状态 | 3 个 View 文件 | 30 分钟 |

---

## 总计

| 优先级 | 任务数 | 预估总工作量 |
|--------|--------|-------------|
| P0 关键修复 | 6 | 2-4 小时 |
| P1 设计系统 | 8 | 3-4 小时 |
| P2 原生 UI 替换 | 6 | 6-8 小时 |
| P3 动画与交互 | 7 | 4-6 小时 |
| P4 UX 增强 | 5 | 5-7 小时 |
| P5 PWA 功能对齐 | 5 | 12-16 小时 |
| P6 服务层健壮性 | 6 | 10-15 小时 |
| P7 无障碍 | 3 | 2-3 小时 |
| **总计** | **46** | **44-63 小时** |

---

> 建议 Codex 按 P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 顺序推进，每完成一个优先级做一次全面测试。P0 和 P1 可并行处理，P2 依赖 P1 的新组件。
