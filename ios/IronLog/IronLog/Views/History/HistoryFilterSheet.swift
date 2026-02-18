import SwiftUI

struct HistoryFilterSheet: View {
    @Binding var query: String
    @Binding var status: String

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Filters")
                    .font(.display(32))

                TextField("Workout title", text: $query)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(Color.botanicalSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(Color.botanicalBorderSubtle, lineWidth: 1)
                    )

                HStack(spacing: 8) {
                    filterButton("All", value: "all")
                    filterButton("Completed", value: "completed")
                    filterButton("In Progress", value: "in_progress")
                }

                Spacer()

                BotanicalButton(title: "Done", variant: .primary) {
                    dismiss()
                }
            }
            .padding(24)
            .background(Color.botanicalBackground.ignoresSafeArea())
        }
    }

    private func filterButton(_ title: String, value: String) -> some View {
        Button(title) {
            status = value
        }
        .font(.botanicalSemibold(13))
        .foregroundStyle(status == value ? Color.botanicalTextPrimary : Color.botanicalTextSecondary)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(status == value ? Color.botanicalAccent : Color.botanicalMuted.opacity(0.6))
        .clipShape(Capsule())
    }
}
