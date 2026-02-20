# IronLog iOS — Codex 开发任务书

> 本文档覆盖 4 个独立改动区域，每个区域包含精确的文件路径、当前代码、目标行为和实现指引。

---

## 目录

1. [New Workout：从 Sheet 弹窗改为全屏页面导航](#task-1)
2. [Add Set 动画 + 练习名称可点击进入详情](#task-2)
3. [ExerciseDetailModal 详情页内容与样式完善](#task-3)
4. [History 页面：滑动删除替换底部按钮](#task-4)

---

<a id="task-1"></a>
## Task 1: New Workout 从 Sheet 弹窗改为全屏页面导航

### 1.1 当前行为

点击 CustomTabBar 中间 "+" 按钮 → 调用 `store.openNewWorkout()` → 设置 `showWorkoutEditor = true` → 在 `MainTabView.swift:42-53` 以 `.sheet` 弹窗形式展示 `WorkoutEditorView`。

```
// MainTabView.swift:42-53 — 当前实现
.sheet(
    isPresented: Binding(
        get: { store.showWorkoutEditor },
        set: { store.showWorkoutEditor = $0 }
    )
) {
    NavigationStack {
        WorkoutEditorView(workoutId: store.activeWorkoutID)
    }
    .presentationDetents([.large])
    .presentationDragIndicator(.visible)
}
```

`AppStore.swift:545-553` 控制状态：

```swift
func openNewWorkout() {
    activeWorkoutID = nil
    showWorkoutEditor = true
}

func openWorkout(id: String) {
    activeWorkoutID = id
    showWorkoutEditor = true
}
```

### 1.2 目标行为

点击 "+" → 以 `fullScreenCover` 或独立 `NavigationStack` push 方式展示 `WorkoutEditorView` 作为独立全屏页面，而非底部弹窗。返回时使用自定义返回按钮或左上角关闭按钮，带动画过渡。

### 1.3 具体修改

#### 文件 1: `MainTabView.swift`

**删除** Line 42-53 的 `.sheet(...)` 代码块。

**替换为** `.fullScreenCover`：

```swift
.fullScreenCover(
    isPresented: Binding(
        get: { store.showWorkoutEditor },
        set: { store.showWorkoutEditor = $0 }
    )
) {
    NavigationStack {
        WorkoutEditorView(workoutId: store.activeWorkoutID)
    }
    .transition(.move(edge: .bottom))
}
```

> 选择 `fullScreenCover` 而非 `navigationDestination` 的原因：WorkoutEditor 是一个独立的编辑上下文，不应参与 Tab 内的 NavigationStack 层级。全屏覆盖更符合 iOS 编辑模式的语义（类似系统日历创建事件）。

#### 文件 2: `WorkoutEditorView.swift`

当前 Line 122-138 的关闭按钮逻辑保持不变（xmark 圆形按钮），但需微调：

- Line 132 的 `Image(systemName: "xmark")` 保持，这在全屏页面下更合理
- 确保 `dismiss()` 在全屏模式下正常关闭（`.fullScreenCover` 的 dismiss 行为与 sheet 一致，无需额外修改）

**新增**：在 `editorBody` 最外层添加进入/退出过渡动画：

```swift
// 在 editorBody 函数的 VStack 上添加
.transition(.move(edge: .bottom).combined(with: .opacity))
.animation(BotanicalMotion.standard, value: viewModel != nil)
```

#### 文件 3: `WorkoutEditorView.swift` — 移除 sheet 相关修饰符

Line 89-93 的 `ExerciseDetailModal` 展示方式中的 `.presentationDetents([.large])` 和 `.presentationDragIndicator(.visible)` 保留不变（那是子 sheet）。

#### 不需要修改的文件

- `AppStore.swift` — `openNewWorkout()` / `openWorkout()` 逻辑无需变化，仍然控制 `showWorkoutEditor` 布尔值
- `CustomTabBar.swift` — `onNewWorkout` 回调无需变化
- `DashboardView.swift` — 通过 `store.openWorkout(id:)` 打开的训练也会走同一个 `showWorkoutEditor` 路径

### 1.4 测试验证

- [ ] 点击 Tab Bar "+" 按钮 → WorkoutEditorView 全屏展示（非弹窗）
- [ ] 从 Dashboard 训练卡片点击 Open → 同样全屏展示
- [ ] 从 History 点击 Open → 同样全屏展示
- [ ] 关闭按钮（xmark）正常关闭页面并保存
- [ ] 完成训练后 SessionReport 弹出正常，关闭后回到主页面
- [ ] Rest Timer 全屏覆盖在 Workout 页面上方正常工作

---

<a id="task-2"></a>
## Task 2: Add Set 动画 + 练习名称可点击进入详情页

### 2.1 Add Set 动画

#### 当前行为

`ExerciseCardView.swift:58` — 点击 "Add Set" 按钮后，调用 `onAddSet` → `WorkoutEditorViewModel.addSet()` → 在 `exercise.sets` 数组末尾追加一个 `WorkoutSet` → UI 直接渲染新 set 行，**无动画过渡**。

#### 目标行为

新 set 行出现时有平滑的插入动画：从下方滑入 + 淡入，同时卡片高度平滑展开。

#### 具体修改

**文件: `ExerciseCardView.swift`**

**修改 1** — Line 52-56，给 ForEach 中的每个 SetRowView 添加过渡动画：

```swift
// 当前代码 (Line 52-56)
ForEach($exercise.sets) { $set in
    SetRowView(set: $set, unit: unit, isPR: checkIfSetIsPR(set: set)) {
        onDeleteSet(set.id)
    }
}

// 改为
ForEach($exercise.sets) { $set in
    SetRowView(set: $set, unit: unit, isPR: checkIfSetIsPR(set: set)) {
        onDeleteSet(set.id)
    }
    .transition(.asymmetric(
        insertion: .move(edge: .bottom).combined(with: .opacity),
        removal: .move(edge: .trailing).combined(with: .opacity)
    ))
}
.animation(.spring(duration: 0.35, bounce: 0.2), value: exercise.sets.map(\.id))
```

**修改 2** — Line 58，给 Add Set 按钮添加触觉反馈：

```swift
// 当前代码 (Line 58)
BotanicalButton(title: "Add Set", variant: .secondary, action: onAddSet)

// 改为
BotanicalButton(title: "Add Set", variant: .secondary) {
    withAnimation(.spring(duration: 0.35, bounce: 0.2)) {
        onAddSet()
    }
    HapticManager.shared.light()
}
```

**文件: `WorkoutEditorViewModel.swift`**

`addSet()` (Line 78-84) 和 `deleteSet()` (Line 87-93) 的内部逻辑不需要修改，动画由 View 层控制。

但 `WorkoutEditorView.swift` 中调用 `onAddSet` 和 `onDeleteSet` 的位置（Line 240-248）也不需要修改，因为动画已在 `ExerciseCardView` 内部添加。

### 2.2 练习名称可点击进入详情页

#### 当前行为

`ExerciseCardView.swift:17-19` — **只有缩略图**（thumbnailView）被 `Button(action: onShowDetail)` 包裹，可以点击进入详情页。

Line 23-31 的练习名称文字（`Text(exerciseDef?.name ?? ...)` 和副标题）是纯文本展示，**不可点击**。

#### 目标行为

点击练习名称区域（名称 + 副标题）也能触发 `onShowDetail`，进入详情页。

#### 具体修改

**文件: `ExerciseCardView.swift`**

**修改** Line 16-32 的 HStack 内部结构：将名称 VStack 包裹到与缩略图同一个 Button action 中。

```swift
// 当前代码 (Line 16-32)
HStack(alignment: .top, spacing: 12) {
    Button(action: onShowDetail) {
        thumbnailView
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Show exercise details")

    VStack(alignment: .leading, spacing: 4) {
        Text(exerciseDef?.name ?? "Unknown Exercise")
            .font(.botanicalSemibold(19))
            .foregroundStyle(Color.botanicalTextPrimary)

        Text(subtitleText)
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(Color.botanicalTextSecondary)
            .lineLimit(1)
    }

    Spacer(minLength: 8)
    // ... remove button
}

// 改为
HStack(alignment: .top, spacing: 12) {
    Button(action: onShowDetail) {
        HStack(alignment: .top, spacing: 12) {
            thumbnailView

            VStack(alignment: .leading, spacing: 4) {
                Text(exerciseDef?.name ?? "Unknown Exercise")
                    .font(.botanicalSemibold(19))
                    .foregroundStyle(Color.botanicalTextPrimary)

                Text(subtitleText)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.botanicalTextSecondary)
                    .lineLimit(1)
            }
        }
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Show exercise details for \(exerciseDef?.name ?? "exercise")")

    Spacer(minLength: 8)

    Button(action: onRemoveExercise) {
        // ... 保持不变
    }
}
```

**关键点**：
- 将 `thumbnailView` 和名称 `VStack` 一起放入同一个 `Button(action: onShowDetail)` 中
- 使用 `.buttonStyle(.plain)` 避免按钮高亮覆盖整个区域
- `Spacer(minLength: 8)` 移到 Button 外面，确保 remove 按钮不在点击区域内
- 更新 accessibilityLabel 使其更具描述性

### 2.3 测试验证

- [ ] 点击 "Add Set" → 新 set 行从底部滑入+淡入，卡片高度平滑展开
- [ ] 多次快速点击 "Add Set" → 每个 set 依次动画出现，无卡顿
- [ ] 滑动删除 set → set 行向右滑出+淡出
- [ ] 点击练习缩略图 → 进入 ExerciseDetailModal
- [ ] 点击练习名称文字 → 同样进入 ExerciseDetailModal
- [ ] 点击练习副标题文字 → 同样进入 ExerciseDetailModal
- [ ] 点击 xmark 移除按钮 → 不触发详情页（remove 按钮不在点击区域内）
- [ ] 触觉反馈：Add Set 点击时有 light haptic

---

<a id="task-3"></a>
## Task 3: ExerciseDetailModal 详情页内容与样式完善

### 3.1 当前状态分析

**文件**: `ExerciseDetailModal.swift`（451 行）

当前详情页包含以下 section：
1. `header` (Line 100-123) — 拖动指示条 + Close 按钮
2. `mediaCarousel` (Line 244-267) — 媒体轮播（图片/视频/YouTube）
3. `titleSection` (Line 126-153) — 名称 + 分类/官方标签
4. `descriptionSection` (Line 156-169) — Markdown 或纯文本描述
5. `currentWorkoutProgressSection` (Line 172-179) — "Current workout: X/Y sets completed" 单行文字
6. `statsSection` (Line 182-213) — 横向滚动 stat 卡片（Volume / Max Weight / Est. 1RM）
7. `historySection` (Line 216-241) — 1RM 趋势图 + 历史记录行

**主要问题**：
- `currentWorkoutProgressSection` 仅一行纯文本，极其简陋
- `statsSection` 的 stat 卡片内容太少，缺少对比箭头和变化趋势
- `historySection` 的历史记录行仅显示日期/max weight/volume，缺少 set 明细
- 没有分隔线或视觉层次，section 之间衔接生硬
- 整体缺少动画，页面滚入时所有内容同时出现

### 3.2 目标效果

将详情页打造为信息丰富、视觉层次分明的练习资料卡。包含：
- 顶部媒体区（保持现有轮播，无需改动）
- 练习基础信息（名称、分类、描述）
- 当前训练进度卡片（进度条 + 完成百分比 + set 列表摘要）
- 数据统计区（带对比箭头的 stat 卡片）
- 个人记录区（PR 高亮卡片）
- 历史趋势图（保持现有 1RM 图表）
- 历史会话列表（可展开查看每组 set 明细）

### 3.3 具体修改

#### 修改 1: 添加 Section 分隔与标题

在每个 section 前添加统一的标题样式和分隔线：

```swift
// 新增一个 helper，插入到 ExerciseDetailModal 内
private func sectionHeader(_ title: String, icon: String) -> some View {
    HStack(spacing: 8) {
        Image(systemName: icon)
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Color.botanicalAccent)
        Text(title)
            .font(.botanicalSemibold(16))
            .foregroundStyle(Color.botanicalTextPrimary)
    }
    .padding(.top, 8)
}
```

在 `body` 的 ScrollView 内部 VStack (Line 75-88) 中，在各 section 前添加 `sectionHeader`：

- `descriptionSection` 前：`sectionHeader("Description", icon: "text.alignleft")`
- `currentWorkoutProgressSection` 前：`sectionHeader("Current Session", icon: "flame.fill")`
- `statsSection` 前：`sectionHeader("Performance", icon: "chart.bar.fill")`
- `historySection` — 已有标题行 (Line 218-220)，替换为 `sectionHeader("History (\(historySessions.count))", icon: "clock.arrow.circlepath")`

#### 修改 2: 重构 `currentWorkoutProgressSection` (Line 172-179)

**当前代码**：

```swift
@ViewBuilder
private var currentWorkoutProgressSection: some View {
    if let currentExercise, !currentExercise.sets.isEmpty {
        let completed = currentExercise.sets.filter(\.completed).count
        Text("Current workout: \(completed)/\(currentExercise.sets.count) sets completed")
            .font(.botanicalBody(14))
            .foregroundStyle(Color.botanicalTextSecondary)
    }
}
```

**替换为**：

```swift
@ViewBuilder
private var currentWorkoutProgressSection: some View {
    if let currentExercise, !currentExercise.sets.isEmpty {
        let total = currentExercise.sets.count
        let completed = currentExercise.sets.filter(\.completed).count
        let progress = total > 0 ? Double(completed) / Double(total) : 0
        let currentVolume = currentExercise.sets
            .filter(\.completed)
            .reduce(0.0) { $0 + $1.weight * Double($1.reps) }

        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Current Session", icon: "flame.fill")

            VStack(alignment: .leading, spacing: 14) {
                // 进度条
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("\(completed)/\(total) sets")
                            .font(.botanicalSemibold(15))
                            .foregroundStyle(Color.botanicalTextPrimary)
                        Spacer()
                        Text("\(Int(progress * 100))%")
                            .font(.botanicalSemibold(15))
                            .foregroundStyle(Color.botanicalAccent)
                    }

                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(Color.botanicalMuted)
                                .frame(height: 8)
                            Capsule()
                                .fill(Color.botanicalAccent)
                                .frame(width: geo.size.width * progress, height: 8)
                                .animation(.spring(duration: 0.5), value: progress)
                        }
                    }
                    .frame(height: 8)
                }

                // 当前 session 数据摘要
                HStack(spacing: 16) {
                    miniStat(label: "Volume", value: "\(Int(currentVolume))")
                    miniStat(label: "Max Weight", value: formatMetric(currentStats.maxWeight, showsDecimal: false))
                    miniStat(label: "Est. 1RM", value: formatMetric(currentStats.maxEstimated1RM, showsDecimal: true))
                }

                // Set 列表摘要
                VStack(spacing: 6) {
                    ForEach(Array(currentExercise.sets.enumerated()), id: \.element.id) { index, set in
                        HStack(spacing: 10) {
                            Text("Set \(index + 1)")
                                .font(.botanicalSemibold(13))
                                .foregroundStyle(Color.botanicalTextSecondary)
                                .frame(width: 48, alignment: .leading)

                            Text("\(Int(set.weight)) × \(set.reps)")
                                .font(.botanicalBody(14))
                                .foregroundStyle(Color.botanicalTextPrimary)

                            Spacer()

                            Image(systemName: set.completed ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 16))
                                .foregroundStyle(set.completed ? Color.botanicalSuccess : Color.botanicalMuted)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .padding(16)
            .background(Color.botanicalSurface)
            .clipShape(RoundedRectangle(cornerRadius: BotanicalTheme.cardCornerRadius, style: .continuous))
        }
    }
}

// 新增 helper
private func miniStat(label: String, value: String) -> some View {
    VStack(spacing: 4) {
        Text(value)
            .font(.botanicalSemibold(18))
            .foregroundStyle(Color.botanicalTextPrimary)
        Text(label)
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(Color.botanicalTextSecondary)
    }
    .frame(maxWidth: .infinity)
}
```

#### 修改 3: 增强 `statsSection` (Line 182-213)

**在每个 stat 卡片中添加与上次的对比指示器。**

修改 `statCard` 方法 (Line 324-348)，新增对比箭头：

```swift
private func statCard(
    title: LocalizedStringKey,
    thisValue: Double?,
    lastValue: Double?,
    prValue: Double?,
    showsDecimal: Bool = false
) -> some View {
    VStack(alignment: .leading, spacing: 9) {
        Text(title)
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(Color.botanicalTextSecondary)
            .tracking(0.8)

        // This session
        HStack {
            Text("exerciseDetail.statsThis")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.botanicalTextSecondary)
            Spacer()
            HStack(spacing: 4) {
                Text(formatMetric(thisValue, showsDecimal: showsDecimal))
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.botanicalTextPrimary)

                // 对比箭头
                if let thisValue, let lastValue, thisValue > 0, lastValue > 0 {
                    Image(systemName: thisValue >= lastValue ? "arrow.up.right" : "arrow.down.right")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(thisValue >= lastValue ? Color.botanicalSuccess : Color.botanicalDanger)
                }
            }
        }

        // Last session
        if let lastValue {
            statRow(label: "exerciseDetail.statsLast", value: lastValue, showsDecimal: showsDecimal)
        }

        // PR
        HStack {
            Text("exerciseDetail.statsPR")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.botanicalTextSecondary)
            Spacer()
            HStack(spacing: 4) {
                Text(formatMetric(prValue, showsDecimal: showsDecimal))
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.botanicalEmphasis)

                if let thisValue, let prValue, thisValue > 0, prValue > 0, thisValue >= prValue {
                    Text("NEW PR")
                        .font(.system(size: 8, weight: .heavy))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color.botanicalEmphasis)
                        .clipShape(Capsule())
                }
            }
        }
    }
    .padding(14)
    .frame(width: 220, alignment: .leading)
    .background(Color.botanicalSurface)
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    .overlay(
        RoundedRectangle(cornerRadius: 16, style: .continuous)
            .stroke(Color.botanicalBorderSubtle, lineWidth: 1)
    )
}
```

#### 修改 4: 增强 `historySection` — 可展开的历史记录行

替换 `historyRow` 方法 (Line 299-321)：

```swift
private func historyRow(workout: Workout) -> some View {
    let sets = completedSets(in: workout)
    let allSets = workout.exercises
        .filter { $0.defId == exerciseDef?.id }
        .flatMap(\.sets)
    let maxWeight = sets.map(\.weight).max() ?? 0
    let totalVolume = sets.reduce(0.0) { $0 + $1.weight * Double($1.reps) }

    return DisclosureGroup {
        // 展开后显示 set 明细
        VStack(spacing: 4) {
            ForEach(Array(allSets.enumerated()), id: \.element.id) { index, set in
                HStack {
                    Text("Set \(index + 1)")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.botanicalTextSecondary)
                        .frame(width: 44, alignment: .leading)
                    Text("\(Int(set.weight)) × \(set.reps)")
                        .font(.botanicalBody(13))
                    Spacer()
                    Image(systemName: set.completed ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 14))
                        .foregroundStyle(set.completed ? Color.botanicalSuccess : Color.botanicalMuted)
                }
                .padding(.vertical, 2)
            }
        }
        .padding(.top, 4)
    } label: {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(DateUtils.formatDisplayDate(workout.date))
                    .font(.botanicalSemibold(14))
                    .foregroundStyle(Color.botanicalTextPrimary)
                Spacer()

                // 完成状态标签
                Text(workout.completed ? "Completed" : "In Progress")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(workout.completed ? Color.botanicalSuccess : Color.botanicalAccent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background((workout.completed ? Color.botanicalSuccess : Color.botanicalAccent).opacity(0.15))
                    .clipShape(Capsule())
            }

            HStack(spacing: 12) {
                Label("\(sets.count) sets", systemImage: "number")
                Label("\(Int(maxWeight)) max", systemImage: "scalemass.fill")
                Label("\(Int(totalVolume)) vol", systemImage: "chart.bar.fill")
            }
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(Color.botanicalTextSecondary)
        }
    }
    .tint(Color.botanicalTextSecondary)
    .padding(14)
    .background(Color.botanicalSurface)
    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
}
```

> **注意**: 如果 `DateUtils` 没有 `formatDisplayDate` 方法，需要新增一个将 "YYYY-MM-DD" 格式化为更可读形式（如 "Feb 20, 2026"）的方法，或者继续使用 `workout.date` 原始字符串。

#### 修改 5: 添加页面进入动画

在 `body` (Line 70-97) 中添加 staggered 出现动画：

```swift
// 新增状态变量
@State private var appeared = false

// 在 body 的 ScrollView 中，给每个 section 添加延迟动画
var body: some View {
    VStack(spacing: 0) {
        header

        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if !mediaItems.isEmpty {
                    mediaCarousel
                        .opacity(appeared ? 1 : 0)
                        .offset(y: appeared ? 0 : 20)
                }

                titleSection
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 20)

                descriptionSection
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 20)

                currentWorkoutProgressSection
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 20)

                statsSection
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 20)

                historySection
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 20)
            }
            // ... padding 保持不变
        }
    }
    .background(Color.botanicalBackground.ignoresSafeArea())
    // ... 其他修饰符保持不变
    .onAppear {
        withAnimation(.easeOut(duration: 0.5).delay(0.15)) {
            appeared = true
        }
    }
}
```

> 为保持简洁，所有 section 统一用一个 `appeared` 变量控制。如果需要更细腻的 staggered 效果，可以为每个 section 使用不同的 delay 值（0.1, 0.15, 0.2, 0.25...），但需要分别用独立的状态变量或基于 index 的计算。

#### 修改 6: descriptionSection 空状态优化

当前 (Line 165-168) 当无描述时显示 "No description" 纯文本。改为更友好的空状态：

```swift
// 替换 Line 165-168
} else {
    HStack(spacing: 8) {
        Image(systemName: "doc.text")
            .foregroundStyle(Color.botanicalMuted)
        Text("No description available")
            .font(.botanicalBody(14))
            .foregroundStyle(Color.botanicalTextSecondary)
    }
    .frame(maxWidth: .infinity, alignment: .center)
    .padding(.vertical, 16)
    .background(Color.botanicalSurface)
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
}
```

### 3.4 测试验证

- [ ] 打开详情页 → 各 section 有淡入+上移动画
- [ ] Current Session 区域显示进度条、百分比、set 列表
- [ ] 进度条宽度随完成 set 数实时更新
- [ ] stat 卡片显示对比箭头（上升绿色/下降红色）
- [ ] 当本次 >= PR 时，显示 "NEW PR" 标签
- [ ] 历史行可展开，展示每个 set 的 weight × reps + 完成状态
- [ ] 无描述时显示友好的空状态卡片
- [ ] 无历史记录时显示空状态（已有此功能，确认保持）
- [ ] 从 ExerciseCardView 点击图片进入 → 数据正确
- [ ] 从 ExerciseCardView 点击名称进入 → 数据正确
- [ ] 从 ExercisePickerSheet 点击 info 按钮进入 → currentExercise 为 nil，Current Session 区域不显示

---

<a id="task-4"></a>
## Task 4: History 页面滑动删除，移除底部按钮

### 4.1 当前行为

**文件**: `HistoryView.swift`

每个训练卡片 (Line 109-154) 内部包含：
- 上方：训练标题 + 日期（可点击打开训练）
- 下方：三个按钮并排 — "Open"（BotanicalButton primary）、"Copy"（BotanicalButton secondary）、删除（红色 trash 图标按钮）

```swift
// Line 127-149 — 当前按钮区域
HStack(spacing: 10) {
    BotanicalButton(title: "Open", variant: .primary) {
        store.openWorkout(id: workout.id)
    }

    BotanicalButton(title: "Copy", variant: .secondary) {
        Task {
            await store.copyWorkout(workoutId: workout.id, targetDate: DateUtils.formatDate())
        }
    }

    Button(role: .destructive) {
        Task { await store.deleteWorkout(id: workout.id) }
    } label: {
        Image(systemName: "trash")
            .foregroundStyle(.white)
            .frame(width: 44, height: 44)
            .background(Color.botanicalDanger)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Delete workout")
}
```

### 4.2 目标行为

- **移除**底部所有三个按钮（Open / Copy / Delete）
- **保留**卡片点击打开训练的功能（Line 112-125 的 Button 已可打开）
- **新增**滑动删除：向左滑动卡片 → 露出红色删除背景 → 继续滑动或松手触发删除
- 参考 `SetRowView.swift` 中已有的滑动删除实现模式

### 4.3 具体修改

**文件: `HistoryView.swift`**

**步骤 1**: 创建一个 `HistoryWorkoutCard` 子视图（提取到同一文件或新建 `HistoryWorkoutCard.swift`），封装滑动删除逻辑。

参考 `SetRowView.swift` 的滑动删除模式 (Line 9-177)：

```swift
private struct HistoryWorkoutCard: View {
    let workout: Workout
    let onOpen: () -> Void
    let onDelete: () -> Void

    @State private var rowOffset: CGFloat = 0
    @State private var isDeleting = false

    private let deleteTriggerDistance: CGFloat = 80
    private let maxSwipeOffset: CGFloat = 100

    var body: some View {
        ZStack(alignment: .trailing) {
            // 删除背景
            HStack {
                Spacer()
                VStack(spacing: 4) {
                    Image(systemName: "trash.fill")
                        .font(.system(size: 16, weight: .bold))
                    Text("Delete")
                        .font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(Color.botanicalDanger)
                .padding(.trailing, 20)
                .opacity(rowOffset < -10 ? 1 : 0)
                .animation(.easeOut(duration: 0.12), value: rowOffset)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.botanicalDangerLight.opacity(0.4))
            .clipShape(RoundedRectangle(cornerRadius: BotanicalTheme.cardCornerRadius, style: .continuous))

            // 卡片内容
            BotanicalCard {
                Button(action: onOpen) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(workout.title)
                            .font(.botanicalSemibold(17))
                            .foregroundStyle(Color.botanicalTextPrimary)

                        HStack(spacing: 8) {
                            Text(workout.date)
                                .font(.botanicalBody(13))
                                .foregroundStyle(Color.botanicalTextSecondary)

                            Text("•")
                                .foregroundStyle(Color.botanicalMuted)

                            Text(workout.completed ? "Completed" : "In Progress")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(workout.completed ? Color.botanicalSuccess : Color.botanicalAccent)

                            Spacer()

                            Text("\(workout.exercises.count) exercises")
                                .font(.botanicalBody(13))
                                .foregroundStyle(Color.botanicalTextSecondary)
                        }

                        // 练习名称摘要
                        if !workout.exercises.isEmpty {
                            Text(exerciseSummary)
                                .font(.botanicalBody(12))
                                .foregroundStyle(Color.botanicalTextSecondary)
                                .lineLimit(1)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
            }
            .offset(x: rowOffset)
            .simultaneousGesture(swipeGesture)
            .animation(.spring(duration: 0.28, bounce: 0.2), value: rowOffset)
        }
        .clipped()
    }

    private var exerciseSummary: String {
        // 这里可以留空或者显示前几个练习名称
        // 由于 HistoryView 层无法直接拿到 exerciseDef name（需要 defId → name 映射），
        // 可以只显示 exercise 数量，或者从外部传入 exerciseDefs
        "\(workout.exercises.flatMap(\.sets).filter(\.completed).count) sets completed"
    }

    private var swipeGesture: some Gesture {
        DragGesture(minimumDistance: 16, coordinateSpace: .local)
            .onChanged { value in
                guard !isDeleting else { return }
                guard abs(value.translation.width) > abs(value.translation.height) else { return }

                if value.translation.width < 0 {
                    rowOffset = max(-maxSwipeOffset, value.translation.width)
                } else {
                    rowOffset = 0
                }
            }
            .onEnded { value in
                guard !isDeleting else { return }
                guard abs(value.translation.width) > abs(value.translation.height) else { return }

                if value.translation.width <= -deleteTriggerDistance {
                    triggerDelete()
                } else {
                    rowOffset = 0
                }
            }
    }

    private func triggerDelete() {
        isDeleting = true
        HapticManager.shared.rigid()
        withAnimation(.spring(duration: 0.2)) {
            rowOffset = -UIScreen.main.bounds.width
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            onDelete()
        }
    }
}
```

**步骤 2**: 替换 `HistoryView` 中 Line 109-154 的 ForEach 内容：

```swift
// 当前代码 (Line 109-154)
ForEach(Array(filtered.enumerated()), id: \.element.id) { index, workout in
    BotanicalCard {
        VStack(alignment: .leading, spacing: 10) {
            Button { ... } label: { ... }   // 标题区
            HStack(spacing: 10) { ... }     // 按钮区 ← 要移除
        }
    }
    .transition(...)
    .animation(...)
}

// 替换为
ForEach(Array(filtered.enumerated()), id: \.element.id) { index, workout in
    HistoryWorkoutCard(
        workout: workout,
        onOpen: { store.openWorkout(id: workout.id) },
        onDelete: {
            Task { await store.deleteWorkout(id: workout.id) }
            store.pushToast("Workout deleted")
        }
    )
    .transition(.asymmetric(
        insertion: .move(edge: .bottom).combined(with: .opacity),
        removal: .move(edge: .trailing).combined(with: .opacity)
    ))
    .animation(BotanicalMotion.standard.delay(Double(index) * 0.03), value: filtered.count)
}
```

**步骤 3**: 删除卡片后的列表动画

确保 ForEach 外层有 `withAnimation`。在 `onDelete` 闭包中：

```swift
onDelete: {
    withAnimation(.spring(duration: 0.35, bounce: 0.15)) {
        Task { await store.deleteWorkout(id: workout.id) }
    }
    store.pushToast("Workout deleted")
}
```

### 4.4 测试验证

- [ ] 历史卡片内不再有 Open / Copy / Delete 三个按钮
- [ ] 卡片点击（标题区域）→ 正常打开训练编辑器
- [ ] 向左滑动卡片 → 露出红色删除背景+垃圾桶图标
- [ ] 滑动距离不足 → 松手回弹
- [ ] 滑动距离超过阈值 → 触发删除 + haptic + 卡片滑出
- [ ] 删除后显示 Toast "Workout deleted"
- [ ] 列表自动更新、其他卡片动画上移填补空间
- [ ] 快速连续删除多个 → 无崩溃或 UI 异常
- [ ] 下拉刷新仍正常工作
- [ ] 筛选/搜索后滑动删除仍正常

---

## 涉及文件清单

| 文件 | Task | 改动类型 |
|------|------|---------|
| `Views/Main/MainTabView.swift` | 1 | `.sheet` → `.fullScreenCover` |
| `Views/WorkoutEditor/WorkoutEditorView.swift` | 1, 2 | 过渡动画 |
| `Views/WorkoutEditor/ExerciseCardView.swift` | 2 | Add Set 动画 + 名称可点击 |
| `Views/Shared/ExerciseDetailModal.swift` | 3 | 大规模重构（增强所有 section） |
| `Views/History/HistoryView.swift` | 4 | 移除按钮 + 新增滑动删除 |
| `Store/AppStore.swift` | — | 无需修改 |
| `ViewModels/WorkoutEditorViewModel.swift` | — | 无需修改 |
| `Views/WorkoutEditor/SetRowView.swift` | — | 无需修改（参考其滑动模式） |

---

## 开发顺序建议

1. **Task 1** 先做（改变 WorkoutEditor 展示方式），因为其他 Task 不依赖此改动但测试时会受影响
2. **Task 2** 次之（Add Set 动画 + 名称点击），独立性强
3. **Task 4** 第三（History 滑动删除），独立性强
4. **Task 3** 最后做（详情页完善），改动量最大但不影响其他功能
