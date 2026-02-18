import Foundation
import PrivySDK

enum PrivyLoginProvider: String, CaseIterable, Identifiable, Sendable {
    case google
    case apple
    case email
    case wallet

    var id: String { rawValue }

    var title: String {
        switch self {
        case .google:
            return "Continue with Google"
        case .apple:
            return "Continue with Apple"
        case .email:
            return "Continue with Email"
        case .wallet:
            return "Continue with Wallet"
        }
    }

    var oauthProvider: OAuthProvider? {
        switch self {
        case .google:
            return .google
        case .apple:
            return .apple
        case .email, .wallet:
            return nil
        }
    }
}

struct PrivyNativeProfile: Sendable {
    let privyDid: String?
    let email: String
    let name: String?
    let photoUrl: String?
    let walletAddress: String?
    let solanaAddress: String?
    let loginMethod: String
}

struct PrivyNativeLoginResult: Sendable {
    let exchange: TokenExchangeResult
    let profile: PrivyNativeProfile
}

final class PrivyAuthService {
    private let tokenExchangeService: TokenExchangeService
    private let walletSIWEService: WalletSIWEService
    private let privy: any Privy

    init(
        tokenExchangeService: TokenExchangeService = TokenExchangeService(),
        walletSIWEService: WalletSIWEService = .shared
    ) {
        self.tokenExchangeService = tokenExchangeService
        self.walletSIWEService = walletSIWEService
        privy = PrivySdk.initialize(
            config: PrivyConfig(appId: Constants.privyAppId, appClientId: Constants.privyAppClientId)
        )
    }

    func handlePrivyToken(_ token: String) async throws -> TokenExchangeResult {
        try await tokenExchangeService.exchange(privyToken: token)
    }

    func loginWithOAuth(provider: PrivyLoginProvider) async throws -> PrivyNativeLoginResult {
        guard let oauthProvider = provider.oauthProvider else {
            let message = provider == .email
                ? "Email login should use OTP flow"
                : "Wallet login should use SIWE flow"
            throw NSError(
                domain: "PrivyAuth",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: message]
            )
        }

        let user = try await privy.oAuth.login(
            with: oauthProvider,
            appUrlScheme: Constants.privyAppURLScheme
        )
        let token = try await user.getAccessToken()
        let exchange = try await tokenExchangeService.exchange(privyToken: token)
        let profile = profileFromPrivyUser(user, fallbackProvider: provider)
        return PrivyNativeLoginResult(exchange: exchange, profile: profile)
    }

    func loginWithWallet() async throws -> PrivyNativeLoginResult {
        let connection = try await walletSIWEService.connectWallet()
        let params = SiweMessageParams(
            appDomain: Constants.privySiweDomain,
            appUri: Constants.privySiweURI,
            chainId: connection.chainId,
            walletAddress: connection.address
        )
        let message = try await privy.siwe.generateMessage(params: params)
        let signature = try await walletSIWEService.signPersonalMessage(message, with: connection)
        let metadata = WalletLoginMetadata(walletClientType: nil, connectorType: "reown_appkit")
        let user = try await privy.siwe.login(
            message: message,
            signature: signature,
            params: params,
            metadata: metadata
        )
        let token = try await user.getAccessToken()
        let exchange = try await tokenExchangeService.exchange(privyToken: token)
        let profile = profileFromPrivyUser(user, fallbackProvider: .wallet)
        return PrivyNativeLoginResult(exchange: exchange, profile: profile)
    }

    func sendEmailOTP(to emailAddress: String) async throws {
        try await privy.email.sendCode(to: emailAddress)
    }

    func verifyEmailOTP(code: String, to emailAddress: String) async throws -> PrivyNativeLoginResult {
        let user = try await privy.email.loginWithCode(code, sentTo: emailAddress)
        let token = try await user.getAccessToken()
        let exchange = try await tokenExchangeService.exchange(privyToken: token)
        let profile = profileFromPrivyUser(user, fallbackProvider: .email)
        return PrivyNativeLoginResult(exchange: exchange, profile: profile)
    }

    func logout() {
        tokenExchangeService.clear()
        Task {
            if let user = await privy.getUser() {
                await user.logout()
            }
        }
    }

    private func profileFromPrivyUser(_ user: any PrivyUser, fallbackProvider: PrivyLoginProvider) -> PrivyNativeProfile {
        var email = ""
        var name: String?
        var walletAddress: String?
        var solanaAddress: String?
        var loginMethod = fallbackProvider.rawValue

        for account in user.linkedAccounts {
            switch account {
            case .google(let google):
                if email.isEmpty {
                    email = google.email
                }
                if name == nil || name?.isEmpty == true {
                    name = google.name
                }
                loginMethod = "google"
            case .apple(let apple):
                if email.isEmpty {
                    email = apple.email
                }
                if loginMethod == fallbackProvider.rawValue {
                    loginMethod = "apple"
                }
            case .email(let emailAccount):
                if email.isEmpty {
                    email = emailAccount.email
                }
                if loginMethod == fallbackProvider.rawValue {
                    loginMethod = "email"
                }
            case .externalWallet(let wallet):
                switch wallet.chainType {
                case .ethereum:
                    if walletAddress == nil || walletAddress?.isEmpty == true {
                        walletAddress = wallet.address
                    }
                case .solana:
                    if solanaAddress == nil || solanaAddress?.isEmpty == true {
                        solanaAddress = wallet.address
                    }
                @unknown default:
                    break
                }
                if loginMethod == fallbackProvider.rawValue {
                    loginMethod = "wallet"
                }
            default:
                continue
            }
        }

        return PrivyNativeProfile(
            privyDid: user.id,
            email: email,
            name: name,
            photoUrl: nil,
            walletAddress: walletAddress,
            solanaAddress: solanaAddress,
            loginMethod: loginMethod
        )
    }
}
