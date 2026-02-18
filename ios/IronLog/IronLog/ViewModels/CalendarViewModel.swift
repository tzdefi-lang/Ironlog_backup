import Foundation
import Observation

@MainActor
@Observable
final class CalendarViewModel {
    enum NavigationDirection {
        case forward
        case backward
        case none
    }

    var monthDate: Date = Date()
    var lastNavigationDirection: NavigationDirection = .none

    func nextMonth() {
        lastNavigationDirection = .forward
        monthDate = Calendar.current.date(byAdding: .month, value: 1, to: monthDate) ?? monthDate
    }

    func previousMonth() {
        lastNavigationDirection = .backward
        monthDate = Calendar.current.date(byAdding: .month, value: -1, to: monthDate) ?? monthDate
    }
}
