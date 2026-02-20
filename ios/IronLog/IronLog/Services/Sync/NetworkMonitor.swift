import Foundation
import Network
import Observation

@Observable
final class NetworkMonitor {
    static let shared = NetworkMonitor()

    var isConnected: Bool = false

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.ironlog.network", qos: .utility)

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                guard let self else { return }
                let wasOffline = !self.isConnected
                self.isConnected = path.status == .satisfied
                if wasOffline && self.isConnected {
                    NotificationCenter.default.post(name: .networkDidReconnect, object: nil)
                }
            }
        }
        monitor.start(queue: queue)

        DispatchQueue.main.async { [weak self] in
            self?.isConnected = self?.monitor.currentPath.status == .satisfied
        }
    }

    deinit {
        monitor.cancel()
    }
}

extension Notification.Name {
    static let networkDidReconnect = Notification.Name("networkDidReconnect")
}
