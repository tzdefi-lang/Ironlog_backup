import Foundation
import Observation

@MainActor
@Observable
final class ManageViewModel {
    enum Tab {
        case exercises
        case templates
    }

    var tab: Tab = .exercises
}
