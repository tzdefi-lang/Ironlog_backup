import Foundation
import Observation

@MainActor
@Observable
final class HistoryViewModel {
    var searchText = ""
    var status: String = "all"
}
