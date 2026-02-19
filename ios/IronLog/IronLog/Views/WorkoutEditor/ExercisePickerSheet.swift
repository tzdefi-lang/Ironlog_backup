import SwiftUI

struct ExercisePickerSheet: View {
    let defs: [ExerciseDef]
    let onSelect: (ExerciseDef) -> Void
    let onEdit: (ExerciseDef) -> Void
    let onDelete: (ExerciseDef) async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var category: String = "All"
    @State private var searchText = ""
    @State private var previewDef: ExerciseDef?

    private var categories: [String] {
        ["All"] + Constants.bodyPartOptions
    }

    private var filtered: [ExerciseDef] {
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
                TextField("Search exercises...", text: $searchText)
                    .padding(10)
                    .background(Color.botanicalSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .padding(.horizontal, 16)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(categories, id: \.self) { item in
                            Button(item) {
                                withAnimation(.easeOut(duration: 0.2)) {
                                    category = item
                                }
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
                        if filtered.isEmpty {
                            Text("No exercises found")
                                .font(.botanicalBody(14))
                                .foregroundStyle(Color.botanicalTextSecondary)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.vertical, 28)
                        }

                        ForEach(filtered) { def in
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
                                        } else {
                                            Text("Personal")
                                                .font(.caption)
                                                .foregroundStyle(Color.botanicalTextSecondary)
                                        }
                                    }
                                }

                                Spacer()

                                Button {
                                    previewDef = def
                                } label: {
                                    Image(systemName: "info.circle")
                                        .font(.system(size: 20))
                                        .foregroundStyle(Color.botanicalTextSecondary)
                                }
                                .buttonStyle(.plain)

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

                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            .background(Color.botanicalBackground.ignoresSafeArea())
            .navigationTitle("Pick Exercise")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .sheet(item: $previewDef) { def in
            ExerciseDetailModal(exerciseDef: def, currentExercise: nil, workouts: [])
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
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
