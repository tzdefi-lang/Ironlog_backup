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
    let chainNamespace: String
    let topic: String
}

enum WalletSIWEError: LocalizedError {
    case missingProjectId
    case invalidChain(String)
    case noActiveSession
    case solanaWalletRequired
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
        case .solanaWalletRequired:
            return "Please connect a Solana wallet to continue."
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
    private static let connectionTimeout: Duration = .seconds(30)
    private static let signatureTimeout: Duration = .seconds(30)

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

        if activeConnection() != nil {
            await disconnectAllSessionsAndPairings()
        }

        do {
            return try await connectWalletOnce()
        } catch let error as WalletSIWEError {
            if case let .connectionRejected(reason) = error, Self.requiresSessionReset(for: reason) {
                await disconnectAllSessionsAndPairings()
                try? await Task.sleep(for: .milliseconds(500))
                return try await connectWalletOnce()
            }
            throw error
        }
    }

    func disconnectAllSessions() async {
        await disconnectAllSessionsAndPairings()
    }

    func signSolanaMessage(_ message: String, with connection: WalletSIWEConnection) async throws -> String {
        try configureIfNeeded()
        guard AppKit.instance.getSessions().contains(where: { $0.topic == connection.topic }) else {
            throw WalletSIWEError.noActiveSession
        }
        guard connection.chainNamespace.caseInsensitiveCompare("solana") == .orderedSame else {
            throw WalletSIWEError.invalidChain("\(connection.chainNamespace):\(connection.chainId)")
        }
        guard let blockchain = Blockchain(namespace: "solana", reference: connection.chainId) else {
            throw WalletSIWEError.invalidChain("solana:\(connection.chainId)")
        }

        let encodedMessage = Self.base58Encode(Data(message.utf8))
        let payloads: [Any] = [
            ["pubkey": connection.address, "message": encodedMessage],
            [encodedMessage, connection.address],
            [connection.address, encodedMessage],
            [["pubkey": connection.address, "message": encodedMessage]],
        ]

        var firstError: Error?
        for payload in payloads {
            do {
                let signature = try await requestSignature(
                    method: "solana_signMessage",
                    payload: payload,
                    connection: connection,
                    blockchain: blockchain
                )
                return Self.normalizeSignatureForPrivy(signature)
            } catch let error as WalletSIWEError {
                if case .signatureRejected(let reason) = error, Self.isUserCancellation(reason) {
                    throw error
                }
                if case .signatureTimedOut = error {
                    throw error
                }
                if firstError == nil {
                    firstError = error
                }
            } catch {
                if firstError == nil {
                    firstError = error
                }
            }
        }

        throw firstError ?? WalletSIWEError.signatureMissing
    }

    private func disconnectAllSessionsAndPairings() async {
        guard isConfigured else { return }

        for session in AppKit.instance.getSessions() {
            try? await AppKit.instance.disconnect(topic: session.topic)
        }

        for pairing in Pair.instance.getPairings() {
            try? await Pair.instance.disconnect(topic: pairing.topic)
        }

        try? await AppKit.instance.cleanup()
    }

    private func connectWalletOnce() async throws -> WalletSIWEConnection {
        try await withCheckedThrowingContinuation { continuation in
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
                        finish(.failure(WalletSIWEError.solanaWalletRequired))
                        return
                    }
                    guard let connection = self.connection(from: session) else {
                        finish(.failure(WalletSIWEError.solanaWalletRequired))
                        return
                    }
                    finish(.success(connection))
                }

            rejectionCancellable = AppKit.instance.sessionRejectionPublisher
                .sink { _, reason in
                    finish(.failure(WalletSIWEError.connectionRejected(Self.userFacingMessage(for: reason.message))))
                }

            Task {
                try? await Task.sleep(for: Self.connectionTimeout)
                finish(.failure(WalletSIWEError.connectionTimedOut))
            }

            DispatchQueue.main.async {
                AppKit.present()
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
        guard let account = session.accounts.first(where: { $0.namespace.caseInsensitiveCompare("solana") == .orderedSame }) else {
            return nil
        }

        let address = account.address.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !address.isEmpty else { return nil }

        return WalletSIWEConnection(
            address: address,
            chainId: account.reference,
            chainNamespace: account.namespace,
            topic: session.topic
        )
    }

    private func requestSignature(
        method: String,
        payload: Any,
        connection: WalletSIWEConnection,
        blockchain: Blockchain
    ) async throws -> String {
        let request = try Request(
            topic: connection.topic,
            method: method,
            params: AnyCodable(any: payload),
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
                        if let signature = Self.extractSignature(from: value) {
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
                try? await Task.sleep(for: Self.signatureTimeout)
                finish(.failure(WalletSIWEError.signatureTimedOut))
            }
        }
    }

    private static func extractSignature(from value: AnyCodable) -> String? {
        if let signature = value.value as? String,
           !signature.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return signature
        }

        if let object = value.value as? [String: Any] {
            if let signature = object["signature"] as? String,
               !signature.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return signature
            }
            if let result = object["result"] as? [String: Any],
               let signature = result["signature"] as? String,
               !signature.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return signature
            }
        }

        if let object = try? value.get([String: String].self),
           let signature = object["signature"],
           !signature.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return signature
        }

        if let array = value.value as? [[String: Any]],
           let signature = array.first?["signature"] as? String,
           !signature.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return signature
        }

        if let array = try? value.get([[String: String]].self),
           let signature = array.first?["signature"],
           !signature.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return signature
        }

        if let array = value.value as? [String],
           let signature = array.first,
           !signature.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return signature
        }

        if let array = try? value.get([String].self),
           let signature = array.first,
           !signature.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return signature
        }

        return nil
    }

    private static func base58Encode(_ data: Data) -> String {
        guard !data.isEmpty else { return "" }

        let alphabet = Array("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")
        var bytes = [UInt8](data)
        var zeros = 0

        while zeros < bytes.count && bytes[zeros] == 0 {
            zeros += 1
        }

        var encoded: [Int] = []
        var startAt = zeros
        while startAt < bytes.count {
            var remainder = 0
            var index = startAt

            while index < bytes.count {
                let value = Int(bytes[index]) + remainder * 256
                bytes[index] = UInt8(value / 58)
                remainder = value % 58
                index += 1
            }

            encoded.append(remainder)

            while startAt < bytes.count && bytes[startAt] == 0 {
                startAt += 1
            }
        }

        var output = String(repeating: "1", count: zeros)
        for digit in encoded.reversed() {
            output.append(alphabet[digit])
        }
        return output
    }

    private static func base58Decode(_ string: String) -> Data? {
        guard !string.isEmpty else { return Data() }

        let alphabet = Array("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")
        var alphabetMap: [Character: Int] = [:]
        alphabetMap.reserveCapacity(alphabet.count)
        for (index, character) in alphabet.enumerated() {
            alphabetMap[character] = index
        }

        var decoded: [UInt8] = [0]

        for character in string {
            guard let value = alphabetMap[character] else { return nil }

            var carry = value
            for idx in stride(from: decoded.count - 1, through: 0, by: -1) {
                let result = Int(decoded[idx]) * 58 + carry
                decoded[idx] = UInt8(result & 0xff)
                carry = result >> 8
            }

            while carry > 0 {
                decoded.insert(UInt8(carry & 0xff), at: 0)
                carry >>= 8
            }
        }

        var leadingZeroCount = 0
        for character in string {
            if character == "1" {
                leadingZeroCount += 1
            } else {
                break
            }
        }

        while decoded.first == 0 {
            decoded.removeFirst()
        }

        return Data(repeating: 0, count: leadingZeroCount) + Data(decoded)
    }

    private static func normalizeSignatureForPrivy(_ signature: String) -> String {
        let trimmed = signature.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return signature }

        if isCanonicalBase64(trimmed) {
            return trimmed
        }

        if let decoded = base58Decode(trimmed), !decoded.isEmpty {
            return decoded.base64EncodedString()
        }

        return trimmed
    }

    private static func isCanonicalBase64(_ value: String) -> Bool {
        guard let data = Data(base64Encoded: value) else { return false }

        let canonical = data.base64EncodedString().trimmingCharacters(in: CharacterSet(charactersIn: "="))
        let candidate = value.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "="))
        return canonical == candidate
    }

    private static func isUserCancellation(_ reason: String) -> Bool {
        let lower = reason.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !lower.isEmpty else { return false }
        return lower.contains("cancel") || lower.contains("reject") || lower.contains("declined")
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

    private static func requiresSessionReset(for reason: String) -> Bool {
        let lower = reason.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !lower.isEmpty else { return false }

        return lower.contains("disconnect your dapp first") ||
            lower.contains("already connected") ||
            lower.contains("existing session") ||
            lower.contains("session currently exists")
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
