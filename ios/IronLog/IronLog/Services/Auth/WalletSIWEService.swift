import Combine
import CryptoSwift
import Foundation
import ReownAppKit
import Starscream
import WalletConnectNetworking
import WalletConnectRelay
import WalletConnectSigner
import Web3

struct WalletSIWEConnection: Sendable {
    let address: String
    let chainId: String
    let topic: String
}

enum WalletSIWEError: LocalizedError {
    case missingProjectId
    case invalidChain(String)
    case noActiveSession
    case unableToResolveAccount
    case connectionTimedOut
    case connectionRejected(String)
    case signatureTimedOut
    case signatureRejected(String)
    case signatureMissing
    case configurationFailed(String)

    var errorDescription: String? {
        switch self {
        case .missingProjectId:
            return "Wallet login unavailable. REOWN_PROJECT_ID is missing."
        case .invalidChain(let chainId):
            return "Unsupported wallet chain: \(chainId)."
        case .noActiveSession:
            return "No active wallet session was found."
        case .unableToResolveAccount:
            return "Unable to resolve wallet account from session."
        case .connectionTimedOut:
            return "Wallet connection timed out. Please try again."
        case .connectionRejected(let reason):
            return reason.isEmpty ? "Wallet connection was cancelled." : reason
        case .signatureTimedOut:
            return "Signature request timed out. Please try again."
        case .signatureRejected(let reason):
            return reason.isEmpty ? "Signature was rejected." : reason
        case .signatureMissing:
            return "Wallet did not return a valid signature."
        case .configurationFailed(let reason):
            return reason
        }
    }
}

final class WalletSIWEService {
    static let shared = WalletSIWEService()

    private let configLock = NSLock()
    private var configured = false

    var isConfigured: Bool {
        configLock.lock()
        defer { configLock.unlock() }
        return configured
    }

    private init() {}

    func handleOpenURL(_ url: URL) -> Bool {
        guard isConfigured else { return false }
        return AppKit.instance.handleDeeplink(url)
    }

    func connectWallet() async throws -> WalletSIWEConnection {
        try configureIfNeeded()

        if let existing = activeConnection() {
            return existing
        }

        return try await withCheckedThrowingContinuation { continuation in
            let resumeLock = NSLock()
            var didResume = false
            var settleCancellable: AnyCancellable?
            var rejectionCancellable: AnyCancellable?

            func finish(_ result: Result<WalletSIWEConnection, Error>) {
                resumeLock.lock()
                defer { resumeLock.unlock() }
                guard !didResume else { return }
                didResume = true
                settleCancellable?.cancel()
                rejectionCancellable?.cancel()
                continuation.resume(with: result)
            }

            settleCancellable = AppKit.instance.sessionSettlePublisher
                .sink { [weak self] session in
                    guard let self else {
                        finish(.failure(WalletSIWEError.unableToResolveAccount))
                        return
                    }
                    guard let connection = self.connection(from: session) else {
                        finish(.failure(WalletSIWEError.unableToResolveAccount))
                        return
                    }
                    finish(.success(connection))
                }

            rejectionCancellable = AppKit.instance.sessionRejectionPublisher
                .sink { _, reason in
                    finish(.failure(WalletSIWEError.connectionRejected(Self.userFacingMessage(for: reason.message))))
                }

            Task {
                try? await Task.sleep(for: .seconds(120))
                finish(.failure(WalletSIWEError.connectionTimedOut))
            }

            DispatchQueue.main.async {
                AppKit.present()
            }
        }
    }

    func signPersonalMessage(_ message: String, with connection: WalletSIWEConnection) async throws -> String {
        try configureIfNeeded()

        guard let blockchain = Blockchain(namespace: "eip155", reference: connection.chainId) else {
            throw WalletSIWEError.invalidChain(connection.chainId)
        }

        let request = try Request(
            topic: connection.topic,
            method: "personal_sign",
            params: AnyCodable(any: [message, connection.address]),
            chainId: blockchain
        )

        return try await withCheckedThrowingContinuation { continuation in
            let resumeLock = NSLock()
            var didResume = false
            var responseCancellable: AnyCancellable?

            func finish(_ result: Result<String, Error>) {
                resumeLock.lock()
                defer { resumeLock.unlock() }
                guard !didResume else { return }
                didResume = true
                responseCancellable?.cancel()
                continuation.resume(with: result)
            }

            responseCancellable = AppKit.instance.sessionResponsePublisher
                .sink { response in
                    guard response.id == request.id else { return }
                    switch response.result {
                    case .response(let value):
                        if let signature = value.value as? String, !signature.isEmpty {
                            finish(.success(signature))
                            return
                        }
                        if let signature = try? value.get(String.self), !signature.isEmpty {
                            finish(.success(signature))
                            return
                        }
                        finish(.failure(WalletSIWEError.signatureMissing))
                    case .error(let error):
                        finish(.failure(WalletSIWEError.signatureRejected(Self.userFacingMessage(for: error.message))))
                    }
                }

            Task {
                do {
                    try await AppKit.instance.request(params: request)
                } catch {
                    finish(.failure(WalletSIWEError.signatureRejected(Self.userFacingMessage(for: error.localizedDescription))))
                }
            }

            Task {
                try? await Task.sleep(for: .seconds(120))
                finish(.failure(WalletSIWEError.signatureTimedOut))
            }
        }
    }

    private func configureIfNeeded() throws {
        let projectId = Constants.reownProjectId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !projectId.isEmpty else {
            throw WalletSIWEError.missingProjectId
        }

        configLock.lock()
        if configured {
            configLock.unlock()
            return
        }
        configured = true
        configLock.unlock()

        do {
            let redirect = try AppMetadata.Redirect(
                native: "\(Constants.privyAppURLScheme)://",
                universal: nil
            )

            let metadata = AppMetadata(
                name: "IronLog",
                description: "IronLog native wallet login",
                url: "https://ironlog.app",
                icons: ["https://ironlog.app/icon.png"],
                redirect: redirect
            )

            Networking.configure(
                groupIdentifier: Constants.reownAppGroup,
                projectId: projectId,
                socketFactory: IronLogSocketFactory()
            )

            AppKit.configure(
                projectId: projectId,
                metadata: metadata,
                crypto: IronLogCryptoProvider(),
                authRequestParams: nil,
                coinbaseEnabled: false
            )
        } catch {
            configLock.lock()
            configured = false
            configLock.unlock()
            throw WalletSIWEError.configurationFailed("Wallet login configuration failed: \(error.localizedDescription)")
        }
    }

    private func activeConnection() -> WalletSIWEConnection? {
        guard let session = AppKit.instance.getSessions().first else { return nil }
        return connection(from: session)
    }

    private func connection(from session: Session) -> WalletSIWEConnection? {
        guard let account = session.accounts.first(where: { $0.namespace == "eip155" }) ?? session.accounts.first else {
            return nil
        }
        return WalletSIWEConnection(
            address: account.address,
            chainId: account.reference,
            topic: session.topic
        )
    }

    private static func userFacingMessage(for reason: String) -> String {
        let trimmed = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Request was cancelled." }
        let lower = trimmed.lowercased()
        if lower.contains("cancel") || lower.contains("rejected") || lower.contains("declined") {
            return "Request was cancelled."
        }
        return trimmed
    }
}

extension WebSocket: @retroactive WebSocketConnecting {}

struct IronLogSocketFactory: WebSocketFactory {
    func create(with url: URL) -> any WebSocketConnecting {
        let socket = WebSocket(url: url)
        socket.callbackQueue = DispatchQueue(label: "com.syntaxis.ironlog.walletconnect.socket", attributes: .concurrent)
        return socket
    }
}

struct IronLogCryptoProvider: CryptoProvider {
    func recoverPubKey(signature: EthereumSignature, message: Data) throws -> Data {
        let publicKey = try EthereumPublicKey(
            message: [UInt8](message),
            v: EthereumQuantity(quantity: BigUInt(signature.v)),
            r: EthereumQuantity(signature.r),
            s: EthereumQuantity(signature.s)
        )
        return Data(publicKey.rawPublicKey)
    }

    func keccak256(_ data: Data) -> Data {
        let digest = SHA3(variant: .keccak256)
        let hash = digest.calculate(for: [UInt8](data))
        return Data(hash)
    }
}
