import SwiftUI

struct HistoryFilterSheet: View {
    @Binding var query: String
    @Binding var status: String
    @Binding var selectedYear: Int?
    @Binding var selectedMonth: Int?
    @Binding var selectedBodyParts: Set<String>

    let availableYears: [Int]
    let availableBodyParts: [String]

    @Environment(\.dismiss) private var dismiss

    private let months: [Int] = Array(1...12)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Filters")
                        .font(.display(32))

                    BotanicalSearchField(placeholder: "Workout title", text: $query)

                    sectionTitle("Status")
                    HStack(spacing: 8) {
                        statusChip("All", value: "all")
                        statusChip("Completed", value: "completed")
                        statusChip("In Progress", value: "in_progress")
                    }

                    sectionTitle("Year")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            filterChip(title: "All", isSelected: selectedYear == nil) {
                                selectedYear = nil
                            }
                            ForEach(availableYears, id: \.self) { year in
                                filterChip(title: "\(year)", isSelected: selectedYear == year) {
                                    selectedYear = year
                                }
                            }
                        }
                    }

                    sectionTitle("Month")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            filterChip(title: "All", isSelected: selectedMonth == nil) {
                                selectedMonth = nil
                            }
                            ForEach(months, id: \.self) { month in
                                filterChip(title: monthTitle(month), isSelected: selectedMonth == month) {
                                    selectedMonth = month
                                }
                            }
                        }
                    }

                    sectionTitle("Body Part")
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 90), spacing: 8)], spacing: 8) {
                        ForEach(availableBodyParts, id: \.self) { part in
                            filterChip(title: part, isSelected: selectedBodyParts.contains(part)) {
                                toggleBodyPart(part)
                            }
                        }
                    }

                    HStack(spacing: 10) {
                        BotanicalButton(title: "Reset", variant: .secondary) {
                            withAnimation(BotanicalMotion.quick) {
                                query = ""
                                status = "all"
                                selectedYear = nil
                                selectedMonth = nil
                                selectedBodyParts = []
                            }
                            HapticManager.shared.warning()
                        }

                        BotanicalButton(title: "Done", variant: .primary) {
                            dismiss()
                        }
                    }
                }
                .padding(24)
            }
            .background(Color.botanicalBackground.ignoresSafeArea())
        }
    }

    private func statusChip(_ title: String, value: String) -> some View {
        filterChip(title: title, isSelected: status == value) {
            withAnimation(BotanicalMotion.quick) {
                status = value
            }
            HapticManager.shared.selection()
        }
    }

    private func filterChip(title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(title) {
            withAnimation(BotanicalMotion.quick) {
                action()
            }
            HapticManager.shared.selection()
        }
        .font(.botanicalSemibold(13))
        .foregroundStyle(isSelected ? Color.botanicalTextPrimary : Color.botanicalTextSecondary)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(isSelected ? Color.botanicalAccent : Color.botanicalMuted.opacity(0.6))
        .clipShape(Capsule())
        .buttonStyle(.plain)
    }

    private func toggleBodyPart(_ part: String) {
        if selectedBodyParts.contains(part) {
            selectedBodyParts.remove(part)
        } else {
            selectedBodyParts.insert(part)
        }
    }

    private func monthTitle(_ month: Int) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"
        let calendar = Calendar(identifier: .gregorian)
        let components = DateComponents(year: 2026, month: month, day: 1)
        guard let date = calendar.date(from: components) else { return "M\(month)" }
        return formatter.string(from: date)
    }

    private func sectionTitle(_ value: String) -> some View {
        Text(value)
            .font(.botanicalSemibold(14))
            .foregroundStyle(Color.botanicalTextSecondary)
    }
}
