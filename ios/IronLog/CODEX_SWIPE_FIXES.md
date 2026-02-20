# IronLog iOS — 滑动交互 & 视觉修复任务书

---

## 目录

1. [滑动删除卡住问题修复（3 处）](#task-1)
2. [Calendar 日历区域左右滑动切换月份](#task-2)
3. [Dashboard 轮播卡片边缘锐利伪影修复](#task-3)

---

<a id="task-1"></a>
## Task 1: 滑动删除卡住问题修复

### 1.1 问题描述

三处滑动删除实现存在"滑到一半卡住"的问题——用户滑动到一半松手后，卡片既不删除也不回弹，停在中间位置。

**根因分析**：所有三处的 `DragGesture` 都有一个相同的 bug 模式：

```swift
.onChanged { value in
    guard abs(value.translation.width) > abs(value.translation.height) else { return }
    // 更新 rowOffset...
}
.onEnded { value in
    guard abs(value.translation.width) > abs(value.translation.height) else { return }
    // 判断删除或回弹...
}
```

**bug**：当用户斜向滑动时，`onChanged` 中的 guard 可能在前几帧通过（水平分量 > 垂直），累积了一些 `rowOffset`。但松手时 `onEnded` 的 `value.translation` 是最终累计位移，如果最终垂直分量 > 水平分量，guard 不通过直接 return —— **什么都不做，卡片就卡在中间了**。

此外 `DayWorkoutListView.swift` 的 `SwipeToDeleteWorkoutCard` 还有一个三态问题：`isDeleteRevealed` 让卡片可以停在半露删除按钮的中间态，用户要求移除这个中间态。

### 1.2 修复原则

- **二元行为**：要么触发删除、要么完全回弹，没有中间停留态
- **回弹动画**：用短促有弹性的 spring，不要慢悠悠的 easeOut
- **onEnded guard 失败时必须 reset**：无论 guard 是否通过，都要做出决策

### 1.3 具体修改

#### 文件 1: `SetRowView.swift`

**修改 `rowSwipeGesture`** (Line 140-162)：

将当前代码：

```swift
private var rowSwipeGesture: some Gesture {
    DragGesture(minimumDistance: 12, coordinateSpace: .local)
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
                resetRowOffset()
            }
        }
}
```

替换为：

```swift
private var rowSwipeGesture: some Gesture {
    DragGesture(minimumDistance: 12, coordinateSpace: .local)
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

            // 关键修复：无论方向判断结果如何，都必须做出决策
            // 只有明确达到删除阈值才删除，其他一律回弹
            if value.translation.width <= -deleteTriggerDistance,
               abs(value.translation.width) > abs(value.translation.height) {
                triggerDelete()
            } else {
                resetRowOffset()
            }
        }
}
```

**修改回弹动画** (Line 25)：

```swift
// 当前
.animation(.spring(duration: 0.24, bounce: 0.2), value: rowOffset)

// 替换为 — 更短促、更脆的弹簧
.animation(.spring(duration: 0.18, bounce: 0.12), value: rowOffset)
```

---

#### 文件 2: `DayWorkoutListView.swift` — `SwipeToDeleteWorkoutCard`

这个组件有最大的问题：`isDeleteRevealed` 中间态 + onEnded guard bug。

**步骤 1**：删除 `isDeleteRevealed` 状态和相关的中间态逻辑。

**步骤 2**：重写 `rowSwipeGesture`。

将当前代码 (Line 41-43, 45-46, 152-177, 190-201) 整体替换：

```swift
// 删除这些状态和常量：
// @State private var isDeleteRevealed = false        ← 删除
// private let deleteActionWidth: CGFloat = 92         ← 删除

// 替换为：
private let deleteTriggerDistance: CGFloat = 100
private let maxSwipeOffset: CGFloat = 120
```

替换 `rowSwipeGesture` (Line 152-177)：

```swift
private var rowSwipeGesture: some Gesture {
    DragGesture(minimumDistance: 14, coordinateSpace: .local)
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

            if value.translation.width <= -deleteTriggerDistance,
               abs(value.translation.width) > abs(value.translation.height) {
                triggerDelete()
            } else {
                closeDeleteAction()
            }
        }
}
```

删除 `revealDeleteAction()` 方法 (Line 190-192)。

修改 `closeDeleteAction()` (Line 195-198)：

```swift
private func closeDeleteAction() {
    rowOffset = 0
    // isDeleteRevealed = false  ← 删除这行，状态已移除
}
```

修改 `body` 中的 `.onTapGesture` (Line 58-61)：

```swift
// 当前
.onTapGesture {
    guard !isDeleting else { return }
    isDeleteRevealed ? closeDeleteAction() : onOpen()
}

// 替换为
.onTapGesture {
    guard !isDeleting else { return }
    if rowOffset < 0 {
        closeDeleteAction()
    } else {
        onOpen()
    }
}
```

**修改动画** (Line 62)：

```swift
// 当前
.animation(.spring(duration: 0.24, bounce: 0.2), value: rowOffset)

// 替换为
.animation(.spring(duration: 0.18, bounce: 0.12), value: rowOffset)
```

---

#### 文件 3: `HistoryView.swift` — `HistoryWorkoutCard`

**修改 `swipeGesture`** (Line 314-336)：

```swift
// 当前
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

            if rowOffset <= -deleteTriggerDistance {
                triggerDelete()
            } else {
                rowOffset = 0
            }
        }
}

// 替换为
private var swipeGesture: some Gesture {
    DragGesture(minimumDistance: 14, coordinateSpace: .local)
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

            if value.translation.width <= -deleteTriggerDistance,
               abs(value.translation.width) > abs(value.translation.height) {
                triggerDelete()
            } else {
                rowOffset = 0
            }
        }
}
```

**修改动画** (Line 303)：

```swift
// 当前
.animation(.spring(duration: 0.28, bounce: 0.2), value: rowOffset)

// 替换为
.animation(.spring(duration: 0.18, bounce: 0.12), value: rowOffset)
```

### 1.4 三处修改的统一模式总结

所有三个文件的 `onEnded` 都要遵循同一个模式：

```swift
.onEnded { value in
    guard !isDeleting else { return }

    // 删除条件：水平距离超过阈值 AND 确实是水平滑动
    if value.translation.width <= -deleteTriggerDistance,
       abs(value.translation.width) > abs(value.translation.height) {
        triggerDelete()
    } else {
        // 其他所有情况一律回弹归零
        rowOffset = 0  // 或 closeDeleteAction() / resetRowOffset()
    }
}
```

所有三处的回弹动画统一为 `.spring(duration: 0.18, bounce: 0.12)` — 短促、干脆。

### 1.5 测试验证

- [ ] **SetRowView**：快速左滑 set 行到阈值 → 删除；未到阈值松手 → 立即干脆回弹
- [ ] **SetRowView**：斜向滑动 → 不会卡在中间，一律回弹
- [ ] **DayWorkoutListView**：左滑日历训练卡片 → 超过阈值删除，未超过立即回弹，无中间停留态
- [ ] **DayWorkoutListView**：点击卡片如果有偏移 → 先回弹；无偏移 → 打开训练
- [ ] **HistoryView**：左滑历史卡片 → 同样二元行为
- [ ] 三处的回弹都干脆不黏腻，约 0.18s 内完成
- [ ] 连续快速滑动多张卡片 → 无卡顿、无卡住

---

<a id="task-2"></a>
## Task 2: Calendar 日历区域左右滑动切换月份

### 2.1 问题描述

`CalendarView.swift` 中，左右滑动切换月份的手势 (Line 142-157) 是 `.gesture(DragGesture(...))` 挂在整个 `ScrollView` 上。但实际效果是只有精确滑动在月份标题区域才能触发，在日历格子（1-28/30/31天）上滑动会被 ScrollView 的内置滚动手势拦截。

**根因**：`ScrollView` 的内置垂直滚动手势优先级高于 `.gesture()` 添加的 `DragGesture`。当用户在日历格子上水平滑动时，系统认为用户可能在尝试垂直滚动，于是把手势交给了 `ScrollView`。

### 2.2 目标行为

在日历格子区域（包含所有日期数字的 LazyVGrid）上水平滑动：
- 向左滑 → 下一个月，日历内容从右侧滑入
- 向右滑 → 上一个月，日历内容从左侧滑入
- 需要一定的最小水平距离阈值（50pt），避免误触
- 切换时有明显的左右滑动过渡动画
- 触觉反馈

### 2.3 具体修改

**文件: `CalendarView.swift`**

**步骤 1**：删除 ScrollView 上的 `.gesture(...)` (Line 142-157)，将手势移到日历格子 ZStack 上。

**步骤 2**：在日历 `ZStack` (Line 77-118) 上使用 `.highPriorityGesture`，并添加拖动偏移实现实时跟手的滑动效果。

新增一个状态变量来跟踪拖动偏移：

```swift
// 在 CalendarView 顶部新增状态
@State private var dragOffset: CGFloat = 0
```

替换整个日历 ZStack 区域 (Line 77-118)：

```swift
ZStack {
    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 7), spacing: 8) {
        ForEach(Array(["S", "M", "T", "W", "T", "F", "S"].enumerated()), id: \.offset) { _, day in
            Text(day)
                .font(.caption2)
                .foregroundStyle(Color.botanicalTextSecondary)
        }

        ForEach(0 ..< leadingBlankCount, id: \.self) { _ in
            Color.clear
                .frame(maxWidth: .infinity, minHeight: 44)
        }

        ForEach(monthDays, id: \.self) { day in
            let dayString = DateUtils.formatDate(day)
            let hasWorkout = store.workouts.contains { $0.date == dayString }

            Button {
                selectedDate = dayString
                HapticManager.shared.selection()
            } label: {
                VStack(spacing: 4) {
                    Text(String(Calendar.current.component(.day, from: day)))
                        .font(.botanicalBody(14))
                    Circle()
                        .fill(hasWorkout ? Color.botanicalAccent : Color.clear)
                        .frame(width: 5, height: 5)
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(selectedDate == dayString ? Color.botanicalAccent.opacity(0.22) : Color.botanicalSurface)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Select \(dayString)")
        }
    }
    .id(calendarID)
    .transition(.asymmetric(
        insertion: .move(edge: viewModel.lastNavigationDirection == .forward ? .trailing : .leading),
        removal: .move(edge: viewModel.lastNavigationDirection == .forward ? .leading : .trailing)
    ))
}
.offset(x: dragOffset)
.highPriorityGesture(
    DragGesture(minimumDistance: 15)
        .onChanged { value in
            // 只响应水平方向为主的拖动
            guard abs(value.translation.width) > abs(value.translation.height) else { return }
            dragOffset = value.translation.width * 0.4  // 阻尼系数让跟手感更自然
        }
        .onEnded { value in
            let horizontalAmount = value.translation.width
            let velocity = value.predictedEndTranslation.width

            // 通过距离或速度判断是否切换月份
            if horizontalAmount < -50 || velocity < -200 {
                withAnimation(.easeInOut(duration: 0.28)) {
                    viewModel.nextMonth()
                    calendarID = UUID()
                    dragOffset = 0
                }
                HapticManager.shared.selection()
            } else if horizontalAmount > 50 || velocity > 200 {
                withAnimation(.easeInOut(duration: 0.28)) {
                    viewModel.previousMonth()
                    calendarID = UUID()
                    dragOffset = 0
                }
                HapticManager.shared.selection()
            } else {
                withAnimation(.spring(duration: 0.2, bounce: 0.1)) {
                    dragOffset = 0
                }
            }
        }
)
.animation(.interactiveSpring(duration: 0.15), value: dragOffset)
```

**关键设计决策**：

- 使用 `.highPriorityGesture` 而非 `.gesture` 或 `.simultaneousGesture`。这确保水平拖动手势优先于 Button 的点击手势，但不影响 ScrollView 的垂直滚动。
- `dragOffset = value.translation.width * 0.4` — 0.4 的阻尼系数让日历跟手移动但有"阻力感"，暗示这是切换而非自由滑动。
- 同时判断 `translation` 和 `predictedEndTranslation`（速度），快速短促的划动也能触发切换。
- 手势只在日历格子的 ZStack 上，不影响上方标题、下方训练列表等其他区域的正常交互。

**步骤 3**：删除原 ScrollView 上的 `.gesture(...)` (Line 142-157)。

将 CalendarView body 中的以下代码删除：

```swift
// 删除这段 (Line 142-157)
.gesture(
    DragGesture(minimumDistance: 20)
        .onEnded { value in
            guard abs(value.translation.width) > abs(value.translation.height) else { return }
            guard abs(value.translation.width) > 50 else { return }
            withAnimation(.easeInOut(duration: 0.28)) {
                if value.translation.width < 0 {
                    viewModel.nextMonth()
                } else {
                    viewModel.previousMonth()
                }
                calendarID = UUID()
            }
            HapticManager.shared.selection()
        }
)
```

### 2.4 测试验证

- [ ] 在日历数字（1-28）区域向左滑动 → 切换到下一个月，带滑动动画
- [ ] 在日历数字区域向右滑动 → 切换到上一个月
- [ ] 滑动不到阈值松手 → 日历回弹到原位
- [ ] 快速短促划动（短距离但速度快）→ 也能触发切换
- [ ] 点击具体日期 → 正常选中该日期，不受滑动手势影响
- [ ] 页面垂直滚动 → 正常工作，不被水平手势拦截
- [ ] 月份标题旁的 < > 按钮 → 仍正常工作
- [ ] 切换时有触觉反馈

---

<a id="task-3"></a>
## Task 3: Dashboard 轮播卡片边缘锐利伪影修复

### 3.1 问题描述

在 Dashboard 首页左右滑动 Recovery Day / New Workout 等轮播卡片时，屏幕左右两侧出现明显的"锐利边缘"——卡片的左右边界有凸起/凹陷的框架感，看起来像是被强行插入一个容器中，尽管颜色相同但明显不在同一个图层。

**根因分析**：

`DashboardView.swift` Line 144-172 的轮播结构：

```
ScrollView                                        ← 整页垂直滚动
  VStack
    .padding(.horizontal, BotanicalTheme.pagePadding)  ← 24pt 水平内边距

    TabView(.page)                                 ← 轮播容器
      ForEach(carouselItems)
        cardView                                   ← BotanicalCard(elevated: true)
          .padding(.vertical, 2)
```

问题出在 `TabView` 被外层 VStack 的 `.padding(.horizontal, 24)` 约束。`TabView` 的 `.page` 样式内部会对页面内容做 clipping，当卡片在切换动画中移动时，它们在 TabView 的边界处被裁剪。但 `BotanicalCard` 有 `elevated: true`（带 shadow），阴影在 clip 边界处被截断，产生"锐利边缘"效果。

同时 `BotanicalCardModifier` (ViewModifiers.swift Line 11) 中 elevated 阴影：
```swift
.shadow(color: .black.opacity(elevated ? 0.05 : 0), radius: elevated ? 8 : 0, x: 0, y: elevated ? 4 : 0)
```
这个阴影 radius 为 8，向四周扩散。当 TabView 的 clip boundary 裁切了左右扩散的阴影，就产生了锐利的直线截断。

### 3.2 目标效果

- 卡片在滑动切换时边缘平滑，无可见的裁剪线
- 卡片滑入/滑出时阴影自然消隐，不会被硬裁剪
- 保持现有的卡片样式和间距

### 3.3 具体修改

**文件: `DashboardView.swift`**

**核心思路**：让 `TabView` 突破水平 padding 限制，延伸到屏幕边缘，给阴影留出扩散空间。卡片内容自己加水平 padding。

替换 `carousel` computed property (Line 144-172)：

```swift
private var carousel: some View {
    VStack(alignment: .leading, spacing: 10) {
        TabView(selection: $selectedCardIndex) {
            ForEach(Array(carouselItems.enumerated()), id: \.element.id) { index, item in
                cardView(item)
                    .tag(index)
                    .padding(.horizontal, BotanicalTheme.pagePadding)
                    .padding(.vertical, 2)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .frame(height: 260)

        HStack {
            ForEach(Array(carouselItems.indices), id: \.self) { index in
                Capsule()
                    .fill(index == selectedCardIndex ? Color.botanicalAccent : Color.botanicalMuted)
                    .frame(width: index == selectedCardIndex ? 20 : 8, height: 8)
                    .animation(BotanicalMotion.quick, value: selectedCardIndex)
            }

            Spacer()

            Text("\(min(selectedCardIndex + 1, carouselItems.count))/\(carouselItems.count)")
                .font(.botanicalSemibold(12))
                .foregroundStyle(Color.botanicalTextSecondary)
        }
        .padding(.horizontal, 4)
    }
    // 关键：让轮播容器突破父级 padding，延伸到屏幕边缘
    .padding(.horizontal, -BotanicalTheme.pagePadding)
}
```

**修改说明**：

1. 在 `carousel` 整体添加 `.padding(.horizontal, -BotanicalTheme.pagePadding)` — 负 padding 抵消父级 VStack 的 24pt 内边距，让 TabView 占满屏幕宽度
2. 在每个 `cardView` 上添加 `.padding(.horizontal, BotanicalTheme.pagePadding)` — 卡片自己内缩 24pt，视觉上保持原来的间距
3. 结果：TabView 的 clip boundary 在屏幕边缘而非卡片边缘，阴影有足够空间自然扩散

**页面指示器也需要补偿**：

指示器在 `.padding(.horizontal, -BotanicalTheme.pagePadding)` 生效后会贴边，需要在指示器 HStack 上补回 padding：

```swift
HStack {
    // ... 指示器内容不变
}
.padding(.horizontal, BotanicalTheme.pagePadding + 4)  // 4 是原有额外 padding
```

完整替换后的 carousel：

```swift
private var carousel: some View {
    VStack(alignment: .leading, spacing: 10) {
        TabView(selection: $selectedCardIndex) {
            ForEach(Array(carouselItems.enumerated()), id: \.element.id) { index, item in
                cardView(item)
                    .tag(index)
                    .padding(.horizontal, BotanicalTheme.pagePadding)
                    .padding(.vertical, 2)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .frame(height: 260)

        HStack {
            ForEach(Array(carouselItems.indices), id: \.self) { index in
                Capsule()
                    .fill(index == selectedCardIndex ? Color.botanicalAccent : Color.botanicalMuted)
                    .frame(width: index == selectedCardIndex ? 20 : 8, height: 8)
                    .animation(BotanicalMotion.quick, value: selectedCardIndex)
            }

            Spacer()

            Text("\(min(selectedCardIndex + 1, carouselItems.count))/\(carouselItems.count)")
                .font(.botanicalSemibold(12))
                .foregroundStyle(Color.botanicalTextSecondary)
        }
        .padding(.horizontal, BotanicalTheme.pagePadding + 4)
    }
    .padding(.horizontal, -BotanicalTheme.pagePadding)
}
```

### 3.4 备选方案（如负 padding 效果不理想）

如果负 padding 在某些布局下有副作用，可以改用另一种方案——在卡片上内收阴影：

**方案 B**：修改 `WorkoutCardView.swift` 和 `RestDayCardView.swift`，将 `BotanicalCard(elevated: true)` 改为 `BotanicalCard(elevated: false)`，手动在内部添加不需要额外空间的内阴影或 border：

```swift
// WorkoutCardView.swift 和 RestDayCardView.swift
BotanicalCard(elevated: false) {
    // 内容不变
}
.overlay(
    RoundedRectangle(cornerRadius: BotanicalTheme.cardCornerRadius, style: .continuous)
        .stroke(Color.botanicalBorderSubtle, lineWidth: 0.5)
)
```

这种方案用 border 替代 shadow，完全不需要额外空间，但视觉效果不如阴影立体。**优先尝试方案 A（负 padding），仅在方案 A 有问题时用方案 B**。

### 3.5 测试验证

- [ ] Dashboard 左右滑动 Recovery Day / New Workout 卡片 → 无边缘锐利线
- [ ] 卡片阴影在滑动过程中自然过渡，无截断
- [ ] 卡片静止时与之前视觉一致（间距、尺寸不变）
- [ ] 页面指示器位置正确，与卡片左对齐
- [ ] 不同数量的轮播项（1个、2个）→ 都正常显示
- [ ] 垂直滚动页面 → 卡片没有多余的溢出

---

## 涉及文件清单

| 文件 | Task | 改动类型 |
|------|------|---------|
| `Views/WorkoutEditor/SetRowView.swift` | 1 | 修改 `onEnded` 逻辑 + 动画参数 |
| `Views/Calendar/DayWorkoutListView.swift` | 1 | 移除 `isDeleteRevealed` 中间态 + 修改 `onEnded` + 动画 |
| `Views/History/HistoryView.swift` (`HistoryWorkoutCard`) | 1 | 修改 `onEnded` 逻辑 + 动画参数 |
| `Views/Calendar/CalendarView.swift` | 2 | 手势从 ScrollView 移到日历 ZStack + 添加拖动偏移跟手效果 |
| `Views/Dashboard/DashboardView.swift` | 3 | 轮播负 padding 扩展 + 卡片自带 padding |

## 开发顺序建议

1. **Task 1** 先做 — 三个文件的修改模式完全一致，可以批量处理
2. **Task 3** 次之 — 独立修改，不影响其他功能
3. **Task 2** 最后 — 涉及手势优先级，需要仔细测试与 ScrollView / Button 的交互
