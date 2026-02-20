import SwiftUI

struct TemplatePickerView: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var selectedTemplateId: String?
    @State private var expandedTemplateId: String?
    @State private var isCreating = false

    private var today: String { DateUtils.formatDate() }

    var body: some View {
        Group {
            if store.templates.isEmpty {
                emptyOrLoadingState
            } else {
                templateList
            }
        }
        .background(Color.botanicalBackground.ignoresSafeArea())
        .navigationTitle("Templates")
        .navigationBarTitleDisplayMode(.inline)
        .dismissKeyboardOnTap()
        .task {
            if store.templates.isEmpty {
                await store.refreshOfficialContent()
            }
        }
    }

    // MARK: - Template List

    private var templateList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(store.templates) { template in
                    templateCard(template)
                }
            }
            .padding(.horizontal, BotanicalTheme.pagePadding)
            .padding(.top, 16)
            .padding(.bottom, 140)
        }
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: - Template Card

    private func templateCard(_ template: WorkoutTemplate) -> some View {
        BotanicalCard {
            VStack(alignment: .leading, spacing: 8) {
                // Header row
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Text(template.name)
                                .font(.botanicalSemibold(16))
                                .foregroundStyle(Color.botanicalTextPrimary)

                            if template.source == .official {
                                Text("Official")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(Color.botanicalSuccess)
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 2)
                                    .background(Color.botanicalSuccess.opacity(0.14))
                                    .clipShape(Capsule())
                            }
                        }

                        Text("\(template.exercises.count) exercises")
                            .font(.botanicalBody(13))
                            .foregroundStyle(Color.botanicalTextSecondary)
                    }
                    Spacer()
                    if selectedTemplateId == template.id {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(Color.botanicalAccent)
                    }
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    withAnimation(BotanicalMotion.quick) {
                        selectedTemplateId = template.id
                    }
                    HapticManager.shared.selection()
                }

                if !template.tagline.isEmpty {
                    Text(template.tagline)
                        .font(.botanicalBody(13))
                        .foregroundStyle(Color.botanicalTextSecondary)
                        .lineLimit(2)
                }

                // Exercise expand/collapse
                exerciseDisclosure(template)

                // Start button (only on selected template)
                if selectedTemplateId == template.id {
                    BotanicalButton(title: "Start Workout", variant: .primary, disabled: isCreating) {
                        startWorkout(templateId: template.id)
                    }
                    .padding(.top, 4)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                }
            }
        }
    }

    // MARK: - Exercise Disclosure

    private func exerciseDisclosure(_ template: WorkoutTemplate) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(BotanicalMotion.quick) {
                    if expandedTemplateId == template.id {
                        expandedTemplateId = nil
                    } else {
                        expandedTemplateId = template.id
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: expandedTemplateId == template.id ? "chevron.up" : "chevron.down")
                        .font(.system(size: 10, weight: .semibold))
                    Text(expandedTemplateId == template.id ? "Hide exercises" : "Show exercises")
                        .font(.system(size: 12, weight: .medium))
                }
                .foregroundStyle(Color.botanicalAccent)
                .padding(.top, 2)
            }
            .buttonStyle(.plain)

            if expandedTemplateId == template.id {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(template.exercises, id: \.defId) { item in
                        let def = store.exerciseDefs.first(where: { $0.id == item.defId })
                        HStack(spacing: 8) {
                            Circle()
                                .fill(Color.botanicalAccent.opacity(0.3))
                                .frame(width: 6, height: 6)
                            Text(def?.name ?? item.defId)
                                .font(.botanicalBody(13))
                                .foregroundStyle(Color.botanicalTextPrimary)
                            Spacer()
                            Text("\(item.defaultSets) sets")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(Color.botanicalTextSecondary)
                        }
                        .padding(.vertical, 2)
                    }
                }
                .padding(.top, 8)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    // MARK: - Empty / Loading State

    private var emptyOrLoadingState: some View {
        VStack(spacing: 16) {
            Spacer()
            if store.isLoading {
                ProgressView()
                    .tint(Color.botanicalAccent)
                Text("Loading templates...")
                    .font(.botanicalBody(15))
                    .foregroundStyle(Color.botanicalTextSecondary)
            } else {
                Image(systemName: "doc.text.magnifyingglass")
                    .font(.system(size: 36))
                    .foregroundStyle(Color.botanicalMuted)
                Text("No templates available")
                    .font(.botanicalSemibold(16))
                    .foregroundStyle(Color.botanicalTextPrimary)
                Text("Pull to refresh or check your connection.")
                    .font(.botanicalBody(14))
                    .foregroundStyle(Color.botanicalTextSecondary)
                BotanicalButton(title: "Retry", variant: .secondary) {
                    Task { await store.refreshOfficialContent() }
                }
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, BotanicalTheme.pagePadding)
    }

    // MARK: - Start Workout

    private func startWorkout(templateId: String) {
        guard !isCreating else { return }
        isCreating = true
        HapticManager.shared.success()

        Task {
            let created = await store.startWorkoutFromTemplate(
                templateId: templateId,
                targetDate: today
            )
            if let created {
                store.openWorkout(id: created.id)
                dismiss()
            } else {
                store.pushToast("Could not create workout. Exercises may not be loaded yet.")
                isCreating = false
            }
        }
    }
}
