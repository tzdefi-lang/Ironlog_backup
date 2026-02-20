import SwiftUI

struct ExercisePickerSheet: View {
    let store: AppStore
    let onSelect: (ExerciseDef) -> Void
    let onEdit: (ExerciseDef) -> Void
    let onDelete: (ExerciseDef) async -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var category: String = "All"
    @State private var searchText = ""
    @State private var detailDef: ExerciseDef?
    @State private var editingDef: ExerciseDef?
    @State private var hasAttemptedLoad = false

    private var categories: [String] {
        ["All"] + Constants.bodyPartOptions
    }

    private var filtered: [ExerciseDef] {
        let defs = store.exerciseDefs
        let byCategory: [ExerciseDef]
        if category == "All" {
            byCategory = defs
        } else {
            byCategory = defs.filter { $0.category == category }
        }

        let searched = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !searched.isEmpty else {
            return byCategory.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        }

        return byCategory
            .filter { $0.name.localizedCaseInsensitiveContains(searched) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                BotanicalSearchField(placeholder: "Search exercises...", text: $searchText)
                    .padding(.horizontal, 16)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(categories, id: \.self) { item in
                            Button(item) {
                                withAnimation(.easeOut(duration: 0.2)) {
                                    category = item
                                }
                                HapticManager.shared.selection()
                            }
                            .font(.botanicalSemibold(13))
                            .foregroundStyle(category == item ? Color.botanicalTextPrimary : Color.botanicalTextSecondary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(category == item ? Color.botanicalAccent : Color.botanicalMuted.opacity(0.7))
                            .clipShape(Capsule())
                        }
                    }
                    .padding(.horizontal, 16)
                }

                ScrollView {
                    LazyVStack(spacing: 0) {
                        if store.exerciseDefs.isEmpty, !hasAttemptedLoad {
                            LoadingStateView(message: "Loading exercises...")
                        } else if filtered.isEmpty {
                            EmptyStateView(
                                icon: "magnifyingglass",
                                title: "No exercises found",
                                description: "Try a different name or category."
                            )
                        }

                        ForEach(filtered) { def in
                            exerciseRow(def)
                        }
                    }
                    .padding(.horizontal, 16)
                }
                .scrollIndicators(.hidden)
                .animation(BotanicalMotion.quick, value: filtered.map(\.id))
            }
            .background(Color.botanicalBackground.ignoresSafeArea())
            .navigationTitle("Pick Exercise")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .sheet(item: $detailDef) { def in
            ExerciseDetailModal(exerciseDef: def, currentExercise: nil, workouts: store.workouts)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(item: $editingDef) { def in
            EditExerciseSheet(exercise: def)
                .environment(store)
        }
        .task {
            if store.exerciseDefs.isEmpty {
                await store.refreshData()
            }
            if store.exerciseDefs.isEmpty {
                await store.refreshOfficialContent()
            }
            hasAttemptedLoad = true
        }
    }

    private func exerciseRow(_ def: ExerciseDef) -> some View {
        HStack(spacing: 12) {
            Button {
                detailDef = def
            } label: {
                HStack(spacing: 12) {
                    thumbnail(for: def)

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
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.botanicalAccent.opacity(0.35))
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }
            }
            .buttonStyle(.plain)

            Spacer()

            if !def.readOnly {
                Menu {
                    Button {
                        editingDef = def
                    } label: {
                        Label("Edit", systemImage: "pencil")
                    }
                    Button(role: .destructive) {
                        Task { await onDelete(def) }
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.botanicalTextSecondary)
                        .frame(width: 36, height: 36)
                        .background(Color.botanicalMuted.opacity(0.4))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }

            Button {
                onSelect(def)
                dismiss()
            } label: {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Color.botanicalAccent)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Add exercise")
        }
        .contentShape(Rectangle())
        .padding(.vertical, 10)
    }

    @ViewBuilder
    private func thumbnail(for def: ExerciseDef) -> some View {
        if let thumb = def.thumbnailUrl, let url = URL(string: thumb) {
            AsyncImage(url: url) { image in
                image
                    .resizable()
                    .scaledToFill()
            } placeholder: {
                Color.botanicalMuted
            }
            .frame(width: 52, height: 52)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        } else {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Color.botanicalMuted)
                .frame(width: 52, height: 52)
                .overlay(
                    Image(systemName: "figure.strengthtraining.traditional")
                        .foregroundStyle(Color.botanicalTextSecondary)
                )
        }
    }
}
