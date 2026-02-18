import Foundation
import Observation

@MainActor
@Observable
final class DashboardViewModel {
    var selectedDate: String = DateUtils.formatDate()
}
