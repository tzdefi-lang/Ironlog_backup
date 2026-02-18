import SwiftUI
import UIKit

struct ProfileSettingsView: View {
    @Environment(AppStore.self) private var store
    @State private var showExporter = false
    @State private var exportURL: URL?
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
                        botanicalToggle(isOn: Binding(
                            get: { prefs.notificationsEnabled },
                            set: { store.setNotificationsEnabled($0) }
                        ))
                    }
                }

                settingCard(title: "profile.exportData") {
                    VStack(spacing: 10) {
                        BotanicalButton(title: "profile.exportJson", variant: .secondary) { exportJSON() }
                        BotanicalButton(title: "profile.exportCsv", variant: .secondary) { exportCSV() }
                    }
                }

                settingCard(title: "profile.account") {
                    BotanicalButton(title: "common.signOut", variant: .danger) {
                        Task { await store.logout() }
                    }
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)
            .padding(.bottom, 60)
        }
        .background(Color.botanicalBackground.ignoresSafeArea())
        .navigationTitle("profile.settingsTitle")
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
