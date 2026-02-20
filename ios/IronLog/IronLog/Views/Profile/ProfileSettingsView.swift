import SwiftUI
import UIKit

struct ProfileSettingsView: View {
    @Environment(AppStore.self) private var store
    @State private var showExporter = false
    @State private var exportURL: URL?
    @State private var cacheSize: String = "…"
    @State private var showClearCacheConfirm = false
    @AppStorage("ironlog_language") private var language = Locale.current.language.languageCode?.identifier ?? "en"

    private var prefs: UserPreferences { store.user?.preferences ?? .default }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                settingCard(title: "profile.units") {
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

                settingCard(title: "profile.appearance") {
                    HStack(spacing: 10) {
                        themeChip("common.light", icon: "sun.max", mode: .light, current: prefs.themeMode)
                        themeChip("common.dark", icon: "moon", mode: .dark, current: prefs.themeMode)
                        themeChip("common.system", icon: "circle.lefthalf.filled", mode: .system, current: prefs.themeMode)
                        Spacer()
                    }
                }

                settingCard(title: "profile.language") {
                    HStack(spacing: 10) {
                        languageChip("profile.languageEnglish", code: "en")
                        languageChip("profile.languageChinese", code: "zh-Hans")
                        Spacer()
                    }
                }

                settingCard(title: "profile.notifications") {
                    HStack {
                        Text("profile.workoutReminders")
                            .font(.botanicalBody(15))
                            .foregroundStyle(Color.botanicalTextPrimary)
                        Spacer()
                        BotanicalToggle(
                            isOn: Binding(
                                get: { prefs.notificationsEnabled },
                                set: { store.setNotificationsEnabled($0) }
                            ),
                            onToggle: { _ in
                                HapticManager.shared.light()
                            }
                        )
                    }
                }

                settingCard(title: "profile.restTimer") {
                    HStack {
                        Text("profile.autoRestTimer")
                            .font(.botanicalBody(15))
                            .foregroundStyle(Color.botanicalTextPrimary)
                        Spacer()
                        BotanicalToggle(
                            isOn: Binding(
                                get: { prefs.autoRestTimer },
                                set: { store.setAutoRestTimer($0) }
                            ),
                            onToggle: { _ in
                                HapticManager.shared.light()
                            }
                        )
                    }
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("profile.exportData")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.botanicalTextSecondary)
                        .tracking(1.2)

                    VStack(spacing: 10) {
                        BotanicalButton(title: "profile.exportJson", variant: .secondary) { exportJSON() }
                        BotanicalButton(title: "profile.exportCsv", variant: .secondary) { exportCSV() }
                    }
                }

                settingCard(title: "profile.clearCacheTitle") {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("profile.clearCacheHint")
                                    .font(.botanicalBody(13))
                                    .foregroundStyle(Color.botanicalTextSecondary)
                            }
                            Spacer()
                            Text(cacheSize)
                                .font(.botanicalSemibold(14))
                                .foregroundStyle(Color.botanicalAccent)
                        }

                        BotanicalButton(title: "profile.clearCacheTitle", variant: .danger) {
                            showClearCacheConfirm = true
                        }
                    }
                }

            }
            .padding(.horizontal, 24)
            .padding(.top, 16)
            .padding(.bottom, 60)
        }
        .scrollIndicators(.hidden)
        .background(Color.botanicalBackground.ignoresSafeArea())
        .navigationTitle("profile.settingsTitle")
        .onAppear { calculateCacheSize() }
        .confirmationDialog(
            Text("profile.clearCacheConfirmTitle"),
            isPresented: $showClearCacheConfirm,
            titleVisibility: .visible
        ) {
            Button("profile.clearCacheConfirmAction", role: .destructive) {
                clearCache()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("profile.clearCacheConfirmBody")
        }
        .sheet(isPresented: $showExporter) {
            if let exportURL {
                ShareSheet(items: [exportURL])
            }
        }
    }

    private func settingCard<Content: View>(title: LocalizedStringKey, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
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

    private func themeChip(_ label: LocalizedStringKey, icon: String, mode: ThemeMode, current: ThemeMode) -> some View {
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

    private func languageChip(_ label: LocalizedStringKey, code: String) -> some View {
        let selected = normalizedLanguage == code
        return Button {
            language = code
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

    private var normalizedLanguage: String {
        let raw = language.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return "en" }
        let lower = raw.lowercased()
        if lower == "zh" || lower.hasPrefix("zh-") {
            return "zh-Hans"
        }
        return raw
    }

    private func exportJSON() {
        let payload: [String: Any] = [
            "exportedAt": ISO8601DateFormatter().string(from: Date()),
            "workouts": store.workouts.map { workout in
                [
                    "id": workout.id,
                    "date": workout.date,
                    "title": workout.title,
                    "completed": workout.completed,
                    "elapsedSeconds": workout.elapsedSeconds,
                    "exercises": workout.exercises.map { exercise in
                        [
                            "defId": exercise.defId,
                            "sets": exercise.sets.map { set in
                                ["weight": set.weight, "reps": set.reps, "completed": set.completed]
                            },
                        ] as [String: Any]
                    },
                ] as [String: Any]
            },
            "exerciseDefs": store.exerciseDefs.map { ["id": $0.id, "name": $0.name, "category": $0.category] },
        ]

        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: .prettyPrinted) else { return }
        let url = FileManager.default.temporaryDirectory
            .appending(path: "ironlog-export-\(UUID().uuidString).json")
        try? data.write(to: url)
        exportURL = url
        showExporter = true
    }

    private func calculateCacheSize() {
        Task.detached(priority: .utility) {
            let fm = FileManager.default
            var totalBytes: Int64 = 0

            // URLCache (network responses, images)
            totalBytes += Int64(URLCache.shared.currentDiskUsage)

            // Caches directory
            if let cachesURL = fm.urls(for: .cachesDirectory, in: .userDomainMask).first {
                totalBytes += Self.directorySize(at: cachesURL)
            }

            // Temp directory
            let tmpURL = fm.temporaryDirectory
            totalBytes += Self.directorySize(at: tmpURL)

            let formatted = ByteCountFormatter.string(fromByteCount: totalBytes, countStyle: .file)
            await MainActor.run {
                cacheSize = formatted
            }
        }
    }

    private func clearCache() {
        URLCache.shared.removeAllCachedResponses()

        let fm = FileManager.default
        if let cachesURL = fm.urls(for: .cachesDirectory, in: .userDomainMask).first,
           let contents = try? fm.contentsOfDirectory(at: cachesURL, includingPropertiesForKeys: nil) {
            for item in contents {
                try? fm.removeItem(at: item)
            }
        }

        let tmpURL = fm.temporaryDirectory
        if let contents = try? fm.contentsOfDirectory(at: tmpURL, includingPropertiesForKeys: nil) {
            for item in contents {
                try? fm.removeItem(at: item)
            }
        }

        calculateCacheSize()
        store.pushToast("Cache cleared")
        HapticManager.shared.success()
    }

    private static func directorySize(at url: URL) -> Int64 {
        let fm = FileManager.default
        guard let enumerator = fm.enumerator(at: url, includingPropertiesForKeys: [.fileSizeKey], options: [.skipsHiddenFiles]) else { return 0 }
        var total: Int64 = 0
        for case let fileURL as URL in enumerator {
            if let size = try? fileURL.resourceValues(forKeys: [.fileSizeKey]).fileSize {
                total += Int64(size)
            }
        }
        return total
    }

    private func exportCSV() {
        var lines = ["date,title,exercises,completed,duration_min"]
        for workout in store.workouts {
            let mins = Int(workout.elapsedSeconds / 60)
            lines.append("\(workout.date),\"\(workout.title)\",\(workout.exercises.count),\(workout.completed),\(mins)")
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
