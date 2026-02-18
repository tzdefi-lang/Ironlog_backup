# IronLog iOS — Codex 开发任务文档

> **执行对象：Codex**
> **项目路径：** `/ios/IronLog/IronLog/`
> **背景：** 本 App 从 PWA（React）迁移至 iOS 原生（SwiftUI）。当前已有基础架构和所有视图框架，但存在大量 UI 动画缺失、功能未完整移植、设计不一致等问题。
> **参考文档：** `iOS-Native-Migration.md`（完整原始规范）、`ISSUES.md`（PWA 问题清单）

---

## 任务优先级说明

- **P0** — 功能性 Bug / Crash，必须修复
- **P1** — 重要 UI 功能缺失，严重影响体验
- **P2** — 设计不一致 / 动画缺失，影响质感
- **P3** — 优化提升

---

## P0：功能性 Bug

### P0-1 CalendarView 日期格子错位

**文件：** `Views/Calendar/CalendarView.swift`

**问题：** `LazyVGrid` 直接从当月第 1 天开始渲染，但未计算该月第 1 天是星期几，导致日期与列标题（S M T W T F S）完全错位。例如，若某月 1 日是周三，格子应从第 4 列开始，但目前从第 1 列开始。

**修复方案：**
```swift
// 在 monthDays 之前计算偏移量（当月1号是周几）
private var leadingBlankCount: Int {
    let cal = Calendar(identifier: .gregorian)
    let weekday = cal.component(.weekday, from: viewModel.monthDate) // 1=Sun, 7=Sat
    // 计算当月1日的偏移（基于月份第一天，非 monthDays[0]）
    guard let firstOfMonth = Calendar.current.date(
        from: Calendar.current.dateComponents([.year, .month], from: viewModel.monthDate)
    ) else { return 0 }
    return Calendar.current.component(.weekday, from: firstOfMonth) - 1
}
```

在 `LazyVGrid` 的 `ForEach` 之前，添加 `leadingBlankCount` 个空白 `Color.clear` 占位格：
```swift
ForEach(0..<leadingBlankCount, id: \.self) { _ in
    Color.clear.frame(minHeight: 44)
}
ForEach(monthDays, id: \.self) { day in
    // ... 现有代码不变
}
```

**验收：** 任意月份的日历格子与星期标题列完全对齐。

---

### P0-2 ExercisePickerSheet 默认分类显示空列表

**文件：** `Views/WorkoutEditor/ExercisePickerSheet.swift`

**问题：** 默认 `category = "Other"`，但大多数 official 练习的 category 不是 "Other"（而是 "Chest"、"Back" 等），导致用户打开选择器看到空列表，无法直觉地选到练习。

**修复方案：**
1. 修改初始 category 为 `"All"`，并在 `filtered` 计算属性中处理 "All" 返回全部练习：
```swift
@State private var category: String = "All"

var filtered: [ExerciseDef] {
    if category == "All" { return defs }
    return defs.filter { $0.category == category }
}
```
2. 在分类按钮的 `Constants.bodyPartOptions` 前面插入 "All"：
```swift
let categories = ["All"] + Constants.bodyPartOptions
ForEach(categories, id: \.self) { item in
    Button(item) { category = item }
    // ...
}
```

**验收：** 打开 ExercisePickerSheet 默认显示所有练习，分类筛选正常工作。

---

### P0-3 WorkoutEditorView ForEach 使用 indices 导致动画崩溃

**文件：** `Views/WorkoutEditor/WorkoutEditorView.swift:168`

**问题：** `ForEach(vm.workout.exercises.indices, id: \.self)` 使用数组下标作为 ID，当删除或重排练习时 SwiftUI diff 算法会出错，可能导致错误的 cell 被渲染或动画崩溃。

**修复方案：** 改为使用 exercise ID：
```swift
// 修改前
ForEach(vm.workout.exercises.indices, id: \.self) { idx in
    let exId = vm.workout.exercises[idx].id
    let def = store.exerciseDefs.first(where: { $0.id == vm.workout.exercises[idx].defId })
    ExerciseCardView(
        exercise: Binding(
            get: { vm.workout.exercises[idx] },
            set: { vm.workout.exercises[idx] = $0 }
        ),
        // ...
    )
}

// 修改后
ForEach(vm.workout.exercises) { exercise in
    let exIdx = vm.workout.exercises.firstIndex(where: { $0.id == exercise.id }) ?? 0
    let def = store.exerciseDefs.first(where: { $0.id == exercise.defId })
    ExerciseCardView(
        exercise: Binding(
            get: { vm.workout.exercises.first(where: { $0.id == exercise.id }) ?? exercise },
            set: { newVal in
                if let i = vm.workout.exercises.firstIndex(where: { $0.id == exercise.id }) {
                    vm.workout.exercises[i] = newVal
                }
            }
        ),
        exerciseDef: def,
        unit: userUnit,
        onAddSet: { vm.addSet(exerciseId: exercise.id) { w in await persistWorkout(w) } },
        onDeleteSet: { setId in vm.deleteSet(exerciseId: exercise.id, setId: setId) { w in await persistWorkout(w) } },
        onRemoveExercise: { vm.removeExercise(exerciseId: exercise.id) { w in await persistWorkout(w) } }
    )
}
```

注意：`ExerciseInstance` 需要 conform to `Identifiable`（已在 `Types.swift` 中有 `id`，确认有 `extension ExerciseInstance: Identifiable {}`）。

**验收：** 添加/删除练习时无崩溃，动画正确。

---

### P0-4 GifVideoPlayer 每次重绘创建新 AVPlayer

**文件：** `Views/Shared/GifVideoPlayer.swift`

**问题：** `AVPlayer(url: url)` 在 `body` 的计算中创建，每次父视图重绘都创建新的 `AVPlayer` 实例，导致内存泄漏和视频重置。

**修复方案：**
```swift
import AVKit
import SwiftUI

struct GifVideoPlayer: View {
    let url: URL
    @State private var player: AVPlayer?

    var body: some View {
        Group {
            if let player {
                VideoPlayer(player: player)
                    .frame(height: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
        .onAppear {
            if player == nil {
                let p = AVPlayer(url: url)
                p.isMuted = true
                // 循环播放
                NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime,
                    object: p.currentItem, queue: .main) { _ in
                    p.seek(to: .zero)
                    p.play()
                }
                p.play()
                player = p
            }
        }
        .onDisappear {
            player?.pause()
            player = nil
        }
        .onChange(of: url) { _, newURL in
            let p = AVPlayer(url: newURL)
            p.isMuted = true
            p.play()
            player = p
        }
    }
}
```

**验收：** 视频自动循环播放，静音，父视图重绘不影响播放状态。

---

### P0-5 CreateExerciseSheet 新创建练习未加入 store 前的竞态

**文件：** `Views/WorkoutEditor/WorkoutEditorView.swift:50-56`

**问题：**
```swift
.sheet(isPresented: $showCreateExercise) {
    CreateExerciseSheet { def in
        viewModel?.addExercise(defId: def.id) { workout in
            await persistWorkout(workout)
        }
    }
}
```
`CreateExerciseSheet` 内部调用 `store.addExerciseDef(def)` 后立即触发 `onCreated(def)` 回调，此时 `store.exerciseDefs` 可能还未更新（因为 `addExerciseDef` 是 async，UI 刷新有延迟），导致 `WorkoutEditorView` 找不到新 def 来渲染 `ExerciseCardView`。

**修复方案：** 在 `CreateExerciseSheet` 的 Save 按钮中，等待 `addExerciseDef` 完成后再调用 `onCreated`（当前已是 `Task { await store.addExerciseDef(def); onCreated(def); dismiss() }`，逻辑正确）。但 `WorkoutEditorView` 中 `addExercise` 操作依赖 `store.exerciseDefs` 已包含新练习。

修复方式：在 `WorkoutEditorViewModel.addExercise` 中，exercise 的 def 不需要从 store 查找，`ExerciseCardView` 应当容忍 `exerciseDef == nil` 并显示 `def.name` 的回退文本（已有此逻辑）。真正的修复是确保 `ExerciseCardView` 在 `exerciseDef` 为 `nil` 时不崩溃（已实现），此 P0 可降级为 P2 并补充观察 store 更新。

---

## P1：重要功能缺失

### P1-1 ExercisePickerSheet 缺少媒体预览和搜索

**文件：** `Views/WorkoutEditor/ExercisePickerSheet.swift`

**现状：** 仅展示练习名称和来源（Personal/Official）。PWA 版本展示了练习的动图/视频预览、搜索框。

**实现要求：**

1. **添加搜索框：**
```swift
@State private var searchText = ""

var filtered: [ExerciseDef] {
    let byCategory = category == "All" ? defs : defs.filter { $0.category == category }
    if searchText.isEmpty { return byCategory }
    return byCategory.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
}
```
在分类 ScrollView 上方添加：
```swift
TextField("Search exercises...", text: $searchText)
    .padding(10)
    .background(Color.botanicalSurface)
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    .padding(.horizontal, 16)
```

2. **List 中每个练习行显示缩略图（thumbnailUrl）：**
```swift
Button { onSelect(def); dismiss() } label: {
    HStack(spacing: 12) {
        if let thumb = def.thumbnailUrl, let url = URL(string: thumb) {
            AsyncImage(url: url) { img in
                img.resizable().scaledToFill()
            } placeholder: {
                Color.botanicalMuted
            }
            .frame(width: 52, height: 52)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        } else {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.botanicalMuted)
                .frame(width: 52, height: 52)
                .overlay(Image(systemName: "figure.strengthtraining.traditional")
                    .foregroundStyle(Color.botanicalTextSecondary))
        }

        VStack(alignment: .leading, spacing: 3) {
            Text(def.name).font(.botanicalSemibold(15))
            Text(def.category).font(.caption).foregroundStyle(.secondary)
        }
        Spacer()
        Image(systemName: "plus.circle.fill")
            .foregroundStyle(Color.botanicalAccent)
    }
}
```

3. **将 `List` 替换为 `LazyVStack` + `ScrollView`（避免 List 默认 iOS 样式）：**
```swift
ScrollView {
    LazyVStack(spacing: 0) {
        ForEach(filtered) { def in
            // 上述 Button 代码
            Divider().padding(.leading, 76)
        }
    }
    .padding(.horizontal, 16)
}
```

**验收：** 搜索可过滤练习名称；每行显示练习缩略图；分类 filter 与搜索联动工作。

---

### P1-2 ExercisePickerSheet 缺少编辑/删除练习功能

**文件：** `Views/WorkoutEditor/ExercisePickerSheet.swift`

**现状：** PWA 中练习选择器支持长按/操作菜单进行编辑和删除个人练习。iOS 版本完全没有此功能。

**实现要求：**

在 ExercisePickerSheet 中：
1. 接受额外参数 `onEdit: (ExerciseDef) -> Void` 和 `onDelete: (ExerciseDef) async -> Void`
2. 练习行添加 `.contextMenu`：
```swift
.contextMenu {
    if !def.readOnly {
        Button("Edit") { onEdit(def) }
        Button("Delete", role: .destructive) {
            Task { await onDelete(def) }
        }
    }
}
```
3. 在 `WorkoutEditorView` 中传递这些回调，并添加 `@State private var editingDef: ExerciseDef?` 和对应的 `.sheet(item: $editingDef) { EditExerciseSheet(def: $0) }`

**WorkoutEditorView 需要修改的 sheet 调用：**
```swift
.sheet(isPresented: $showExercisePicker) {
    ExercisePickerSheet(
        defs: store.exerciseDefs,
        onSelect: { def in
            viewModel?.addExercise(defId: def.id) { w in await persistWorkout(w) }
        },
        onEdit: { def in
            showExercisePicker = false
            editingDef = def
        },
        onDelete: { def in
            await store.deleteExerciseDef(id: def.id)
        }
    )
}
.sheet(item: $editingDef) { def in
    EditExerciseSheet(def: def)
}
```

**验收：** 长按个人练习弹出 context menu，可编辑/删除；官方练习无此菜单。

---

### P1-3 ExerciseDetailModal 缺少媒体展示和历史记录

**文件：** `Views/Shared/ExerciseDetailModal.swift`

**现状：** 仅显示练习名称、纯文本描述、sessions 数量。PWA 版本显示了：
- 动图/视频演示
- Markdown 格式的描述
- 该练习的历史 sets（按时间倒序，显示每次最重的 set）
- 1RM 趋势（mini chart）

**实现要求：**

```swift
import SwiftUI
import MarkdownUI  // 需要 swift-markdown-ui SPM 包

struct ExerciseDetailModal: View {
    let exerciseDef: ExerciseDef?
    let currentExercise: ExerciseInstance?
    let workouts: [Workout]

    @Environment(\.dismiss) private var dismiss

    // 该练习相关的历史 sessions（倒序）
    private var historySessions: [Workout] {
        workouts.filter { w in
            w.exercises.contains { $0.defId == exerciseDef?.id }
        }.sorted { $0.date > $1.date }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {

                    // 1. 媒体展示（视频/图片轮播）
                    if let def = exerciseDef, !def.mediaItems.isEmpty {
                        TabView {
                            ForEach(def.mediaItems) { item in
                                mediaView(item: item)
                            }
                        }
                        .tabViewStyle(.page(indexDisplayMode: .automatic))
                        .frame(height: 240)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }

                    // 2. 标题
                    Text(exerciseDef?.name ?? "Exercise")
                        .font(.display(28))

                    // 3. 分类 chip
                    if let cat = exerciseDef?.category {
                        Text(cat)
                            .font(.botanicalSemibold(12))
                            .foregroundStyle(Color.botanicalAccent)
                            .padding(.horizontal, 10).padding(.vertical, 4)
                            .background(Color.botanicalAccent.opacity(0.15))
                            .clipShape(Capsule())
                    }

                    // 4. Markdown 描述（使用 swift-markdown-ui）
                    if let markdown = exerciseDef?.markdown, !markdown.isEmpty {
                        Markdown(markdown)
                            .markdownTheme(.basic)
                            .font(.botanicalBody(15))
                    } else if let desc = exerciseDef?.description, !desc.isEmpty {
                        Text(desc)
                            .font(.botanicalBody(15))
                            .foregroundStyle(Color.botanicalTextSecondary)
                    }

                    Divider()

                    // 5. 历史记录
                    Text("History (\(historySessions.count) sessions)")
                        .font(.botanicalSemibold(16))

                    ForEach(historySessions.prefix(10)) { workout in
                        historyRow(workout: workout)
                    }
                }
                .padding(24)
            }
            .background(Color.botanicalBackground.ignoresSafeArea())
            .navigationTitle("")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    @ViewBuilder
    private func mediaView(item: ExerciseMediaItem) -> some View {
        if item.kind == .youtube, let url = URL(string: item.url) {
            // YouTube: 用 WebView 嵌入
            YouTubeWebView(url: url).frame(height: 240)
        } else if let url = URL(string: item.url) {
            if item.contentType == .video {
                GifVideoPlayer(url: url)
            } else {
                AsyncImage(url: url) { img in img.resizable().scaledToFit() }
                    placeholder: { Color.botanicalMuted }
                .frame(height: 240)
            }
        }
    }

    private func historyRow(workout: Workout) -> some View {
        let sets = workout.exercises.filter { $0.defId == exerciseDef?.id }.flatMap(\.sets).filter(\.completed)
        let maxWeight = sets.map(\.weight).max() ?? 0
        let totalVolume = sets.reduce(0.0) { $0 + $1.weight * Double($1.reps) }

        return VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(workout.date)
                    .font(.botanicalSemibold(14))
                Spacer()
                Text("\(Int(maxWeight)) kg max")
                    .font(.botanicalBody(13))
                    .foregroundStyle(Color.botanicalTextSecondary)
            }
            Text("\(sets.count) sets · \(Int(totalVolume)) kg volume")
                .font(.caption)
                .foregroundStyle(Color.botanicalTextSecondary)
        }
        .padding(12)
        .background(Color.botanicalSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
```

同时需要创建 `YouTubeWebView.swift`（WKWebView 嵌入 YouTube embed URL）：
```swift
// Views/Shared/YouTubeWebView.swift
import WebKit
import SwiftUI

struct YouTubeWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.scrollView.isScrollEnabled = false
        webView.load(URLRequest(url: url))
        return webView
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
```

**验收：** 媒体（视频/图片/YouTube）正确显示；Markdown 格式化渲染；历史记录列表显示。

---

### P1-4 CreateExerciseSheet / EditExerciseSheet 缺少媒体上传

**文件：** `Views/WorkoutEditor/CreateExerciseSheet.swift`、`Views/WorkoutEditor/EditExerciseSheet.swift`

**现状：** 两个表单仅支持 name、description、category 三个字段，缺少：
- usesBarbell / barbellWeight 设置
- 媒体上传（图片/视频）
- YouTube 链接添加

**实现要求：**

在 `CreateExerciseSheet.swift` 中添加以下内容：

```swift
import PhotosUI
import SwiftUI

struct CreateExerciseSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store

    @State private var name = ""
    @State private var detail = ""
    @State private var category = "Other"
    @State private var usesBarbell = false
    @State private var barbellWeight: Double = 20.0
    @State private var youtubeLink = ""
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var uploadedMediaURL: String?
    @State private var isUploading = false

    let onCreated: (ExerciseDef) -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Basic") {
                    TextField("Name", text: $name)
                    TextField("Description", text: $detail, axis: .vertical)
                        .lineLimit(3...6)
                }

                Section("Category") {
                    Picker("Category", selection: $category) {
                        ForEach(Constants.bodyPartOptions, id: \.self) { Text($0).tag($0) }
                    }
                }

                Section("Barbell") {
                    Toggle("Uses Barbell", isOn: $usesBarbell)
                    if usesBarbell {
                        HStack {
                            Text("Bar Weight")
                            Spacer()
                            TextField("kg", value: $barbellWeight, format: .number)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 80)
                            Text("kg").foregroundStyle(.secondary)
                        }
                    }
                }

                Section("Media") {
                    // 图片/视频上传
                    PhotosPicker(selection: $selectedPhoto, matching: .any(of: [.images, .videos])) {
                        HStack {
                            Image(systemName: "photo.on.rectangle.angled")
                            Text(uploadedMediaURL != nil ? "Media Uploaded ✓" : "Add Photo or Video")
                        }
                    }
                    .onChange(of: selectedPhoto) { _, item in
                        guard let item else { return }
                        Task {
                            isUploading = true
                            defer { isUploading = false }
                            if let data = try? await item.loadTransferable(type: Data.self) {
                                let ext = item.supportedContentTypes.first?.preferredFilenameExtension ?? "jpg"
                                let path = "exercises/\(UUID().uuidString).\(ext)"
                                if let url = try? await MediaUploadService.shared.upload(data: data, path: path) {
                                    uploadedMediaURL = url
                                }
                            }
                        }
                    }

                    if isUploading {
                        ProgressView("Uploading...")
                    }

                    // YouTube 链接
                    TextField("YouTube Link (optional)", text: $youtubeLink)
                        .keyboardType(.URL)
                        .autocorrectionDisabled()
                }
            }
            .navigationTitle("New Exercise")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        var mediaItems: [ExerciseMediaItem] = []
                        if let uploadedURL = uploadedMediaURL {
                            mediaItems.append(ExerciseMediaItem(
                                id: UUID().uuidString,
                                kind: .upload,
                                contentType: uploadedURL.hasSuffix(".mp4") || uploadedURL.hasSuffix(".mov") ? .video : .image,
                                url: uploadedURL,
                                title: nil
                            ))
                        }
                        if !youtubeLink.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            mediaItems.append(ExerciseMediaItem(
                                id: UUID().uuidString,
                                kind: .youtube,
                                contentType: .video,
                                url: youtubeLink.trimmingCharacters(in: .whitespacesAndNewlines),
                                title: "YouTube"
                            ))
                        }

                        let def = ExerciseDef(
                            id: UUID().uuidString,
                            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                            description: detail,
                            source: .personal,
                            readOnly: false,
                            thumbnailUrl: uploadedMediaURL,
                            markdown: "",
                            mediaItems: mediaItems,
                            mediaUrl: uploadedMediaURL,
                            mediaType: nil,
                            category: category,
                            usesBarbell: usesBarbell,
                            barbellWeight: barbellWeight
                        )
                        Task {
                            await store.addExerciseDef(def)
                            onCreated(def)
                            dismiss()
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isUploading)
                }
            }
        }
    }
}
```

同理，`EditExerciseSheet.swift` 也需要加入相同字段，并预填已有值。

**注意：** 需确认 `MediaUploadService.swift` 有一个 `upload(data: Data, path: String) async throws -> String` 的方法（返回公开 URL）。

**验收：** 创建练习时可以选择照片/视频上传、填写 YouTube 链接、设置是否使用杠铃及重量。

---

### P1-5 ExerciseCardView 缺少"查看详情"入口和 PR 徽章

**文件：** `Views/WorkoutEditor/ExerciseCardView.swift`

**现状：** 仅有练习名、分类、sets 列表、"Add Set"按钮、删除按钮。PWA 版本有"查看历史"按钮打开 ExerciseDetailModal，并在 sets 中 PR 突破时显示金色徽章。

**实现要求：**

1. 在 ExerciseCardView 的 header 中添加"详情"按钮：
```swift
struct ExerciseCardView: View {
    @Binding var exercise: ExerciseInstance
    let exerciseDef: ExerciseDef?
    let unit: Unit
    let historicalPRs: [String: PRRecord]  // 新增：当前 workout 之前的 PR 数据
    let onAddSet: () -> Void
    let onDeleteSet: (String) -> Void
    let onRemoveExercise: () -> Void
    let onShowDetail: () -> Void  // 新增：打开详情

    var body: some View {
        BotanicalCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(exerciseDef?.name ?? "Unknown Exercise")
                            .font(.botanicalSemibold(18))
                        Text(exerciseDef?.category ?? "Other")
                            .font(.caption).foregroundStyle(Color.botanicalTextSecondary)
                    }
                    Spacer()
                    // 详情按钮
                    Button(action: onShowDetail) {
                        Image(systemName: "info.circle")
                            .foregroundStyle(Color.botanicalAccent)
                    }
                    .buttonStyle(.plain)
                    .padding(.trailing, 8)

                    Button(role: .destructive, action: onRemoveExercise) {
                        Image(systemName: "trash")
                    }
                }

                ForEach($exercise.sets) { $set in
                    let isPR = checkIfSetIsPR(set: set.wrappedValue)
                    SetRowView(set: $set, unit: unit, isPR: isPR) {
                        onDeleteSet(set.wrappedValue.id)
                    }
                }

                BotanicalButton(title: "Add Set", variant: .secondary, action: onAddSet)
            }
        }
    }

    // 判断该 set 是否突破 PR
    private func checkIfSetIsPR(set: WorkoutSet) -> Bool {
        guard set.completed, let defId = exerciseDef?.id else { return false }
        guard let record = historicalPRs[defId] else { return true } // 无历史，即新 PR
        let current1RM = set.weight * (1 + Double(set.reps) / 30)
        return current1RM > record.maxEstimated1RM || set.weight > record.maxWeight
    }
}
```

2. `SetRowView` 新增 `isPR: Bool` 参数，显示金色徽章：
```swift
struct SetRowView: View {
    @Binding var set: WorkoutSet
    let unit: Unit
    let isPR: Bool  // 新增
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Toggle("", isOn: $set.completed).labelsHidden()

            // ... 现有 weight/reps 字段 ...

            if isPR && set.completed {
                Text("PR")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.white)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color(hex: "#C27B66"))  // botanicalEmphasis
                    .clipShape(Capsule())
            }

            Spacer()
            Button(role: .destructive, action: onDelete) {
                Image(systemName: "trash")
            }.buttonStyle(.plain)
        }
    }
}
```

3. 在 `WorkoutEditorView` 中传递历史 PR 数据，并添加 `@State private var detailExercise: ExerciseDef?`：
```swift
// 在 WorkoutEditorView 顶部
private var historicalPRs: [String: PRRecord] {
    guard let vm = viewModel else { return [:] }
    let otherWorkouts = store.workouts.filter { $0.id != vm.workout.id }
    return PRService.calculatePRs(workouts: otherWorkouts)
}

// 在 editorBody 中
ExerciseCardView(
    // ...
    historicalPRs: historicalPRs,
    onShowDetail: {
        detailExercise = def
    }
)

// 添加 sheet
.sheet(item: $detailExercise) { def in
    ExerciseDetailModal(exerciseDef: def, currentExercise: nil, workouts: store.workouts)
}
```

**验收：** 点击 ℹ️ 按钮打开 ExerciseDetailModal；超 PR 的已完成 set 显示橙色"PR"徽章。

---

### P1-6 WorkoutEditorView 缺少练习拖拽排序

**文件：** `Views/WorkoutEditor/WorkoutEditorView.swift`

**现状：** 练习列表使用 `ForEach` 在 `ScrollView` 内，无法拖拽排序。PWA 版本支持长按拖拽排序（FLIP 动画）。

**实现要求：**

将练习列表替换为支持 `.onMove` 的 `List`，并隐藏 List 默认样式：

```swift
// 替换 ScrollView + ForEach 中的练习列表部分
List {
    ForEach(vm.workout.exercises) { exercise in
        let def = store.exerciseDefs.first(where: { $0.id == exercise.defId })
        ExerciseCardView(
            exercise: Binding(/* ... */),
            exerciseDef: def,
            unit: userUnit,
            historicalPRs: historicalPRs,
            onAddSet: { /* ... */ },
            onDeleteSet: { /* ... */ },
            onRemoveExercise: { /* ... */ },
            onShowDetail: { detailExercise = def }
        )
        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }
    .onMove { from, to in
        vm.workout.exercises.move(fromOffsets: from, toOffset: to)
        Task { await persistWorkout(vm.workout) }
    }

    // 底部按钮作为 List rows
    // 注意：Add Exercise / Create Exercise 按钮需要放在 List 外（VStack 包裹）
}
.listStyle(.plain)
.scrollDisabled(true)  // 外层 ScrollView 管理滚动
.environment(\.editMode, .constant(.active))  // 始终显示拖拽手柄
```

**注意：** List 内的拖拽手柄（三横线）默认显示在右侧，可以通过 editMode = .active 始终显示，或通过 `.moveDisabled(false)` 控制。由于 List 有自己的滚动，需要配合外层 ScrollView 使用 `.scrollDisabled(true)` 或将整个内容放在单个 List 中。

**验收：** 长按练习条目后可上下拖拽排序；排序结果自动保存。

---

### P1-7 RestTimerView 缺少圆形进度环

**文件：** `Views/WorkoutEditor/RestTimerView.swift`

**现状：** 仅有黑色半透明遮罩 + 文字倒计时 + 分段选择器。PWA 版本有精美的圆形 SVG 进度环（带动画），支持触摸减少时间。

**实现要求：**

```swift
struct RestTimerView: View {
    let durationSeconds: Int
    let restartToken: Int
    let onClose: () -> Void
    let onDurationChange: (Int) -> Void

    @State private var remaining = 0
    @State private var task: Task<Void, Never>?

    // 进度（0.0 到 1.0）
    private var progress: Double {
        durationSeconds > 0 ? Double(remaining) / Double(durationSeconds) : 0
    }

    var body: some View {
        ZStack {
            Color.botanicalBackground.ignoresSafeArea()

            VStack(spacing: 32) {
                Text("Rest Timer")
                    .font(.display(28))
                    .foregroundStyle(Color.botanicalTextPrimary)

                // 圆形进度环
                ZStack {
                    // 背景环
                    Circle()
                        .stroke(Color.botanicalMuted, lineWidth: 12)
                        .frame(width: 220, height: 220)

                    // 进度环（顺时针，从顶部开始）
                    Circle()
                        .trim(from: 0, to: progress)
                        .stroke(
                            Color.botanicalAccent,
                            style: StrokeStyle(lineWidth: 12, lineCap: .round)
                        )
                        .frame(width: 220, height: 220)
                        .rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 1.0), value: progress)

                    // 中心文字
                    VStack(spacing: 4) {
                        Text(DateUtils.formatDuration(Double(remaining)))
                            .font(.system(size: 52, weight: .bold, design: .rounded))
                            .foregroundStyle(Color.botanicalTextPrimary)
                            .contentTransition(.numericText())

                        Text("remaining")
                            .font(.botanicalBody(14))
                            .foregroundStyle(Color.botanicalTextSecondary)
                    }
                }

                // 时长选择器（Botanical 胶囊样式，替代 segmented picker）
                HStack(spacing: 8) {
                    ForEach([30, 60, 90, 120, 180], id: \.self) { sec in
                        Button("\(sec)s") {
                            onDurationChange(sec)
                            restart(duration: sec)
                        }
                        .font(.botanicalSemibold(13))
                        .foregroundStyle(durationSeconds == sec ? Color.botanicalTextPrimary : Color.botanicalTextSecondary)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(durationSeconds == sec ? Color.botanicalAccent : Color.botanicalMuted.opacity(0.6))
                        .clipShape(Capsule())
                        .animation(.easeOut(duration: 0.22), value: durationSeconds)
                    }
                }

                // 关闭按钮
                BotanicalButton(title: "Done", variant: .primary, action: {
                    // 完成时触觉反馈
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                    onClose()
                })
                .frame(maxWidth: 200)
            }
            .padding(32)
        }
        .onAppear { restart(duration: durationSeconds) }
        .onChange(of: restartToken) { _, _ in restart(duration: durationSeconds) }
        .onDisappear { task?.cancel() }
    }

    private func restart(duration: Int) {
        task?.cancel()
        remaining = duration
        task = Task {
            while !Task.isCancelled && remaining > 0 {
                try? await Task.sleep(for: .seconds(1))
                if !Task.isCancelled {
                    remaining = max(0, remaining - 1)
                    // 每秒轻触觉
                    if remaining > 0 {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    }
                }
            }
            // 倒计时结束：强触觉 + 系统音效
            if !Task.isCancelled {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                AudioServicesPlaySystemSound(1007)
                onClose()
            }
        }
    }
}
```

**验收：** 显示圆形进度环；时长选择使用 Botanical 胶囊样式；倒计时结束自动关闭并触觉反馈。

---

### P1-8 SessionReportView 缺少分享功能和动画

**文件：** `Views/WorkoutEditor/SessionReportView.swift`

**现状：** 极简的静态报告卡片。PWA 版本有：
- 每项统计数字的进入动画（数字从 0 增长到目标值）
- 分享按钮（生成训练图片 via Canvas/ImageRenderer）

**实现要求：**

1. **数字动画（`withAnimation` + `@State` 驱动的计数器）：**
```swift
@State private var animatedDuration = 0
@State private var animatedCompletion = 0
@State private var animatedVolume = 0

.onAppear {
    withAnimation(.easeOut(duration: 1.2)) {
        animatedDuration = durationMinutes
        animatedCompletion = completion
        animatedVolume = volume
    }
}

// 使用 animatedDuration 替代 durationMinutes 显示
reportRow("Duration", "\(animatedDuration) min")
```

2. **分享按钮（使用 iOS 16+ ImageRenderer）：**
```swift
@State private var showShareSheet = false
@State private var shareImage: UIImage?

// header 中添加分享按钮
Button {
    generateShareImage()
} label: {
    Image(systemName: "square.and.arrow.up")
        .foregroundStyle(Color.botanicalAccent)
}

// 生成分享图片
private func generateShareImage() {
    let renderer = ImageRenderer(content: shareCard)
    renderer.scale = UIScreen.main.scale
    if let uiImage = renderer.uiImage {
        shareImage = uiImage
        showShareSheet = true
    }
}

// 分享卡片视图（用于渲染）
private var shareCard: some View {
    VStack(alignment: .leading, spacing: 16) {
        Text("IronLog").font(.display(14)).foregroundStyle(Color.botanicalTextSecondary)
        Text(workout.title).font(.display(28))
        HStack(spacing: 20) {
            statChip("⏱", "\(durationMinutes)min")
            statChip("✓", "\(completion)%")
            statChip("🏋️", "\(volume)kg")
        }
        if !prBreaks.isEmpty {
            Text("🏆 \(prBreaks.count) PR broken!").font(.botanicalSemibold(14))
        }
    }
    .padding(24)
    .background(Color.botanicalSurface)
    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    .frame(width: 320)
}

// 弹出分享面板
.sheet(isPresented: $showShareSheet) {
    if let img = shareImage {
        ShareLink(item: Image(uiImage: img), preview: SharePreview("My Workout", image: Image(uiImage: img)))
    }
}
```

3. **PR 展示改进**（更直观显示每条 PR）：
```swift
ForEach(prBreaks) { item in
    HStack {
        Image(systemName: "trophy.fill").foregroundStyle(.yellow)
        Text(item.exerciseName).font(.botanicalSemibold(14))
        Spacer()
        Text("\(item.metric.rawValue): \(Int(item.previous))→\(Int(item.current))")
            .font(.botanicalBody(13))
            .foregroundStyle(Color.botanicalTextSecondary)
    }
    .padding(10)
    .background(Color.botanicalEmphasis.opacity(0.1))
    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
}
```

**验收：** 报告出现时有数字计数动画；点击分享按钮生成图片并打开系统分享面板。

---

## P2：设计不一致

### P2-1 SetRowView 使用 iOS 默认 roundedBorder 样式

**文件：** `Views/WorkoutEditor/SetRowView.swift`

**问题：** `textFieldStyle(.roundedBorder)` 是系统默认蓝色边框样式，与 Botanical 设计不一致。

**修复：** 替换为自定义 Botanical 样式：
```swift
// 修改 weight TextField
TextField("0", value: $set.weight, format: .number.precision(.fractionLength(0...1)))
    .keyboardType(.decimalPad)
    .multilineTextAlignment(.center)
    .font(.botanicalSemibold(16))
    .frame(width: 80, height: 44)
    .background(Color.botanicalSurface)
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
        .stroke(set.completed ? Color.botanicalSuccess.opacity(0.4) : Color.botanicalBorderSubtle, lineWidth: 1))

// 修改 reps TextField（同上）
TextField("0", value: $set.reps, format: .number)
    .keyboardType(.numberPad)
    .multilineTextAlignment(.center)
    .font(.botanicalSemibold(16))
    .frame(width: 64, height: 44)
    .background(Color.botanicalSurface)
    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    .overlay(...)
```

同时：将 `Toggle` 改为自定义圆形勾选按钮（与 PWA 一致）：
```swift
Button {
    set.completed.toggle()
    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
} label: {
    ZStack {
        Circle()
            .fill(set.completed ? Color.botanicalSuccess : Color.clear)
            .frame(width: 28, height: 28)
            .overlay(Circle().stroke(set.completed ? Color.botanicalSuccess : Color.botanicalBorderSubtle, lineWidth: 2))
        if set.completed {
            Image(systemName: "checkmark")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color.white)
        }
    }
}
.buttonStyle(.plain)
.animation(.spring(duration: 0.22, bounce: 0.3), value: set.completed)
```

**验收：** set 输入框为 Botanical 圆角卡片样式；完成状态有绿色边框高亮；勾选按钮有弹簧动画和触觉反馈。

---

### P2-2 WorkoutEditorView Header 按钮样式不一致

**文件：** `Views/WorkoutEditor/WorkoutEditorView.swift:86-150`

**问题：** Header 使用系统默认 `Button` 样式（蓝色文字链接），`Image(systemName:)` 按钮没有背景和适当的触摸区域。

**修复：**
```swift
// Close 按钮改为 Botanical 圆形按钮
Button {
    Task {
        await persistWorkout(vm.workout)
        store.showWorkoutEditor = false
        dismiss()
    }
} label: {
    Image(systemName: "xmark")
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(Color.botanicalTextSecondary)
        .frame(width: 36, height: 36)
        .background(Color.botanicalMuted.opacity(0.5))
        .clipShape(Circle())
}
.buttonStyle(PressableButtonStyle())

// 右侧操作按钮（clock, play/pause, checkmark）统一样式：
func headerActionButton(icon: String, color: Color = Color.botanicalTextPrimary, action: @escaping () -> Void) -> some View {
    Button(action: action) {
        Image(systemName: icon)
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(color)
            .frame(width: 40, height: 40)
            .background(Color.botanicalSurface)
            .clipShape(Circle())
            .shadow(color: .black.opacity(0.06), radius: 8, x: 0, y: 2)
    }
    .buttonStyle(PressableButtonStyle())
}

// 完成按钮（checkmark）用 botanicalEmphasis 背景色
headerActionButton(icon: "checkmark", color: .white) {
    // ...
}
// 修改：
Button { ... } label: {
    Image(systemName: "checkmark")
        .font(.system(size: 16, weight: .bold))
        .foregroundStyle(.white)
        .frame(width: 40, height: 40)
        .background(Color.botanicalEmphasis)
        .clipShape(Circle())
        .shadow(color: Color.botanicalEmphasis.opacity(0.4), radius: 8, x: 0, y: 4)
}
.buttonStyle(PressableButtonStyle())
```

**验收：** 关闭按钮为灰色圆形；操作按钮有白色卡片背景；完成按钮为橙色强调色，按下有缩放动画。

---

### P2-3 CustomTabBar 切换 Tab 缺少动画

**文件：** `Views/Main/CustomTabBar.swift`

**问题：** Tab 图标颜色切换无动画，感觉生硬。

**修复：**
```swift
// 在 tabButton 添加 animation
private func tabButton(_ icon: String, tab: MainTabView.Tab) -> some View {
    Button {
        withAnimation(.spring(duration: 0.3, bounce: 0.2)) {
            selectedTab = tab
        }
    } label: {
        VStack(spacing: 4) {
            Image(systemName: selectedTab == tab ? icon : icon.replacingOccurrences(of: ".fill", with: ""))
                .font(.system(size: 20, weight: selectedTab == tab ? .bold : .regular))
                .foregroundStyle(selectedTab == tab ? Color.botanicalTextPrimary : Color.botanicalTextSecondary)
                .frame(width: 36, height: 36)
                // 选中时的背景高亮
                .background(
                    Circle()
                        .fill(selectedTab == tab ? Color.botanicalAccent.opacity(0.2) : Color.clear)
                        .scaleEffect(selectedTab == tab ? 1.0 : 0.0)
                )
        }
    }
    .buttonStyle(PressableButtonStyle())
    .animation(.spring(duration: 0.3, bounce: 0.25), value: selectedTab)
}
```

**验收：** 切换 Tab 时图标有弹簧动画；选中 Tab 有浅绿色圆形背景。

---

### P2-4 DashboardView 缺少 Today's In-Progress 工作状态标记

**文件：** `Views/Dashboard/DashboardView.swift`

**问题：** 当天未完成的 workout 与已完成的 workout 在 WorkoutCardView 中看起来完全一样。PWA 中有"In Progress"状态标签。

**修复：** 在 `WorkoutCardView` 中添加 `isInProgress: Bool` 参数：
```swift
struct WorkoutCardView: View {
    let workout: Workout
    let subtitle: String
    let isInProgress: Bool  // 新增
    // ...

    var body: some View {
        BotanicalCard(elevated: true) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(subtitle)
                        .font(.botanicalSemibold(12))
                        .foregroundStyle(Color.botanicalTextSecondary)
                    Spacer()
                    if isInProgress {
                        HStack(spacing: 4) {
                            Circle().fill(Color.botanicalSuccess).frame(width: 6, height: 6)
                            Text("In Progress")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Color.botanicalSuccess)
                        }
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Color.botanicalSuccess.opacity(0.12))
                        .clipShape(Capsule())
                    }
                }
                // ... 其他内容
            }
        }
    }
}

// DashboardView 中调用时
WorkoutCardView(
    workout: todays,
    subtitle: "Today",
    isInProgress: !todays.completed && todays.startTimestamp != nil,
    // ...
)
```

---

### P2-5 CalendarView 月份切换缺少过渡动画

**文件：** `Views/Calendar/CalendarView.swift`

**问题：** 点击左右箭头切换月份，日历格子直接跳变，没有滑动动画。

**修复：**
```swift
// 在 CalendarViewModel 中添加方向跟踪
enum NavigationDirection { case forward, backward, none }
var lastNavigationDirection: NavigationDirection = .none

// 在 CalendarView 中
@State private var calendarID = UUID()  // 用于触发 transition

LazyVGrid(/* ... */)
    .id(calendarID)
    .transition(.asymmetric(
        insertion: .move(edge: viewModel.lastNavigationDirection == .forward ? .trailing : .leading),
        removal: .move(edge: viewModel.lastNavigationDirection == .forward ? .leading : .trailing)
    ))

// 修改导航按钮
Button(action: {
    withAnimation(.easeInOut(duration: 0.28)) {
        viewModel.previousMonth()
        calendarID = UUID()
    }
}) {
    Image(systemName: "chevron.left")
}
```

---

### P2-6 MainTabView 缺少 Tab 切换页面动画

**文件：** `Views/Main/MainTabView.swift`

**问题：** `TabView` 没有禁用默认的页面滑动行为，用户可以在 Tab 间左右滑动，这与 app 预期的图标导航体验不一致，且可能与 WorkoutEditor sheet 的手势冲突。

**修复：**
```swift
TabView(selection: $selectedTab) {
    NavigationStack { DashboardView() }.tag(Tab.dashboard)
    NavigationStack { CalendarView() }.tag(Tab.calendar)
    NavigationStack { StatsView() }.tag(Tab.stats)
    NavigationStack { ProfileView() }.tag(Tab.profile)
}
.tabViewStyle(.page(indexDisplayMode: .never))
.toolbar(.hidden, for: .tabBar)
// 禁用滑动切换（只允许通过 tab bar 切换）：
.gesture(DragGesture())  // 覆盖 TabView 的内置滑动手势
```

或者改用 `ZStack` + `@ViewBuilder` 控制显示的 View，完全避免 TabView 的页面滑动。

---

### P2-7 StatsView 练习选择器样式不一致

**文件：** `Views/Stats/StatsView.swift`

**问题：** 使用 `.pickerStyle(.menu)` 是系统默认下拉菜单样式，不符合 Botanical 设计。

**修复：** 替换为 ScrollView + 胶囊按钮的选择器（与 ExercisePickerSheet 分类选择一致）：
```swift
ScrollView(.horizontal, showsIndicators: false) {
    HStack(spacing: 8) {
        ForEach(selectableExercises) { def in
            Button(def.name) {
                viewModel.selectedExerciseID = def.id
            }
            .font(.botanicalSemibold(13))
            .foregroundStyle(selectedExerciseId == def.id ? Color.botanicalTextPrimary : Color.botanicalTextSecondary)
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background(selectedExerciseId == def.id ? Color.botanicalAccent : Color.botanicalMuted.opacity(0.6))
            .clipShape(Capsule())
            .animation(.easeOut(duration: 0.22), value: selectedExerciseId)
        }
    }
    .padding(.horizontal, 2)
}
```

---

### P2-8 HistoryView 搜索框和筛选样式

**文件：** `Views/History/HistoryView.swift`、`Views/History/HistoryFilterSheet.swift`

需要确认以下几点，如不满足则修复：
- 搜索框使用 Botanical 样式（`Color.botanicalSurface` 背景 + 圆角），而非系统 `.searchable`
- 工作状态 filter（All / Completed / In Progress）使用 Botanical 胶囊按钮，而非 Picker
- workout 列表行使用 `BotanicalCard` 而非 `List` 默认样式

---

### P2-9 ExerciseCardView 缺少折叠/展开功能

**文件：** `Views/WorkoutEditor/ExerciseCardView.swift`

**现状：** 所有练习的 sets 始终展开，当练习很多时界面很长。PWA 版本支持点击练习名折叠/展开 sets。

**实现（可选，如时间允许）：**
```swift
@State private var isExpanded = true

// header 的点击区域控制展开
Button { withAnimation(.spring(duration: 0.3, bounce: 0.15)) { isExpanded.toggle() } } label: {
    HStack {
        VStack(alignment: .leading, spacing: 3) { /* 练习名称 */ }
        Spacer()
        Image(systemName: "chevron.down")
            .rotationEffect(.degrees(isExpanded ? 0 : -90))
            .animation(.easeOut(duration: 0.22), value: isExpanded)
    }
}
.buttonStyle(.plain)

// sets 列表
if isExpanded {
    ForEach($exercise.sets) { /* ... */ }
    BotanicalButton(title: "Add Set", ...)
}
```

---

## P3：优化提升

### P3-1 Toast 系统集中化管理

**现状：** 缺少全局 Toast 管理系统。PWA 有 `pushToast` 全局 action。

**实现：** 在 `AppStore` 中添加 Toast 队列，在 `MainTabView` 上层用 `overlay` 显示 `ToastView`，可参考 PWA 的 `ui.tsx:ToastContainer`。

---

### P3-2 SkeletonView 加载态

**现状：** `SkeletonView` 存在但 shimmer 动画需要确认是否正确实现（渐变动画从左到右流动）。

**参考 PWA：** 使用 `LinearGradient` + `@State private var phase: CGFloat = 0` + `withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) { phase = 1 }` 实现流光效果。

---

### P3-3 所有 NavigationTitle 统一使用 Botanical 字体

**问题：** 多个视图使用系统默认 NavigationTitle（San Francisco Bold）而非 Playfair Display。

**修复：** 对每个使用 `.navigationTitle()` 的视图，改为自定义 header：
```swift
// 不用 .navigationTitle，改为在 ScrollView 顶部插入
Text("Workout")
    .font(.display(42))
    .foregroundStyle(Color.botanicalTextPrimary)
    .padding(.horizontal, 24)
    .padding(.top, 12)
```
所有主视图（Dashboard、Calendar、Stats、Profile、History）均需统一。

---

### P3-4 WorkoutEditorView 标题输入框样式

**文件：** `Views/WorkoutEditor/WorkoutEditorView.swift:154-157`

**现状：** `TextField("Workout title", ...)` 使用默认样式，在深色背景上不够明显。

**修复：** 添加适当样式：
```swift
TextField("Workout title", text: ...)
    .font(.display(34))
    .foregroundStyle(Color.botanicalTextPrimary)
    .padding(.vertical, 4)
// 添加下划线分隔
Divider().background(Color.botanicalBorderSubtle)
```

---

### P3-5 深色模式验证

**需要确认：** 所有视图在深色模式（`@Environment(\.colorScheme) == .dark`）下：
- 背景色正确切换（`Color.botanicalBackground` 使用 xcassets Light/Dark variant）
- 文字颜色对比度符合 WCAG AA
- 卡片、输入框、按钮阴影在深色背景上可见

---

## 文件修改汇总表

| 文件 | 修改类型 | 优先级 |
|------|---------|--------|
| `Views/Calendar/CalendarView.swift` | Bug Fix：日期格偏移计算 | P0 |
| `Views/WorkoutEditor/ExercisePickerSheet.swift` | Bug Fix：默认分类；Feature：搜索+缩略图+编辑/删除 | P0+P1 |
| `Views/WorkoutEditor/WorkoutEditorView.swift` | Bug Fix：ForEach ID；Feature：拖拽排序+PR历史+详情Modal | P0+P1 |
| `Views/Shared/GifVideoPlayer.swift` | Bug Fix：AVPlayer 生命周期管理+循环 | P0 |
| `Views/WorkoutEditor/CreateExerciseSheet.swift` | Feature：媒体上传+usesBarbell | P1 |
| `Views/WorkoutEditor/EditExerciseSheet.swift` | Feature：媒体上传+usesBarbell（与Create一致） | P1 |
| `Views/Shared/ExerciseDetailModal.swift` | Feature：媒体展示+Markdown渲染+历史记录 | P1 |
| `Views/WorkoutEditor/ExerciseCardView.swift` | Feature：详情按钮+PR徽章+折叠 | P1 |
| `Views/WorkoutEditor/SetRowView.swift` | Design：自定义勾选+Botanical输入框+PR徽章 | P1+P2 |
| `Views/WorkoutEditor/RestTimerView.swift` | Feature：圆形进度环+触觉反馈+自动关闭 | P1 |
| `Views/WorkoutEditor/SessionReportView.swift` | Feature：数字动画+分享按钮+PR改进 | P1 |
| `Views/Shared/YouTubeWebView.swift` | New：YouTube embed WKWebView | P1 |
| `Views/Main/CustomTabBar.swift` | Design：切换动画+选中高亮 | P2 |
| `Views/Dashboard/DashboardView.swift` | Design：In Progress 状态标记 | P2 |
| `Views/Dashboard/WorkoutCardView.swift` | Design：isInProgress 参数 | P2 |
| `Views/Calendar/CalendarView.swift` | Design：月份切换动画 | P2 |
| `Views/Main/MainTabView.swift` | Design：禁用 Tab 滑动手势 | P2 |
| `Views/Stats/StatsView.swift` | Design：Botanical 练习选择器 | P2 |

---

## 新增文件清单

| 文件路径 | 说明 |
|---------|------|
| `Views/Shared/YouTubeWebView.swift` | YouTube WKWebView 嵌入组件 |

---

## 重要架构注意事项

1. **`ExerciseInstance` 需要 conform to `Identifiable`：** 确认 `Types.swift` 中 `ExerciseInstance` 有 `var id: String`，并添加 `extension ExerciseInstance: Identifiable {}`（如未添加）。

2. **`swift-markdown-ui` 依赖：** `ExerciseDetailModal` 的 Markdown 渲染需要确认 `Package.resolved` 中已包含此依赖。如未添加，在 Xcode SPM 中添加：
   - URL: `https://github.com/gonzalezreal/swift-markdown-ui`
   - Version: `2.4.0`

3. **`MediaUploadService` 接口：** P1-4 中调用 `MediaUploadService.shared.upload(data:path:)` 需要确认服务有此方法签名，必要时适配现有接口。

4. **`PRRecord` 类型：** `SetRowView` 的 PR 徽章需要 `PRService.calculatePRs()` 的返回类型，确认 `PRService.swift` 中 `PRRecord` struct 有 `maxWeight` 和 `maxEstimated1RM` 字段。

5. **`ExerciseDef` Identifiable：** 确认 `ExerciseDef` 有 `extension ExerciseDef: Identifiable {}` 使 `ForEach(store.exerciseDefs)` 可以正常工作。

---

## 验收总标准

1. 所有 P0 修复后：无功能性崩溃，核心 workout 记录流程（新建→添加练习→记录组→完成）完整可用
2. 所有 P1 完成后：功能完整度与 PWA 版本一致，练习视频演示可看，创建练习支持媒体上传
3. 所有 P2 完成后：视觉设计与 Botanical 设计系统完全一致，动画流畅自然
4. 深色/浅色模式均正常显示
5. 所有按钮触摸区域 ≥ 44×44pt（iOS HIG 标准）
