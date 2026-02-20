import Foundation
import Observation

@MainActor
@Observable
final class HistoryViewModel {
    var searchText = ""
    var status: String = "all"
    var selectedYear: Int?
    var selectedMonth: Int?
    var selectedBodyParts: Set<String> = []

    var hasAdvancedFilters: Bool {
        selectedYear != nil || selectedMonth != nil || !selectedBodyParts.isEmpty || status != "all" || !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    func clearAll() {
        searchText = ""
        status = "all"
        selectedYear = nil
        selectedMonth = nil
        selectedBodyParts = []
    }
}
