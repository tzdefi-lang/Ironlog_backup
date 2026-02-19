import Foundation
import PrivySDK

enum PrivyLoginProvider: String, CaseIterable, Identifiable, Sendable {
    case google
    case apple
    case email

    var id: String { rawValue }

    var title: String {
        switch self {
        case .google:
            return "Continue with Google"
        case .apple:
            return "Continue with Apple"
        case .email:
            return "Continue with Email"
        }
    }

    var oauthProvider: OAuthProvider? {
        switch self {
        case .google:
            return .google
        case .apple:
            return .apple
        case .email:
            return nil
        }
    }
}

struct PrivyNativeProfile: Sendable {
    let privyDid: String?
    let email: String
    let name: String?
    let photoUrl: String?
    let loginMethod: String
}

struct PrivyNativeLoginResult: Sendable {
    let exchange: TokenExchangeResult
    let profile: PrivyNativeProfile
}

final class PrivyAuthService {
    private let tokenExchangeService: TokenExchangeService
    private let privy: any Privy

    init(
        tokenExchangeService: TokenExchangeService = TokenExchangeService()
    ) {
        self.tokenExchangeService = tokenExchangeService
        privy = PrivySdk.initialize(
            config: PrivyConfig(appId: Constants.privyAppId, appClientId: Constants.privyAppClientId)
        )
    }

    func handlePrivyToken(_ token: String) async throws -> TokenExchangeResult {
        try await tokenExchangeService.exchange(privyToken: token)
    }

    func loginWithOAuth(provider: PrivyLoginProvider) async throws -> PrivyNativeLoginResult {
        guard let oauthProvider = provider.oauthProvider else {
            throw NSError(
                domain: "PrivyAuth",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "Email login should use OTP flow"]
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

    func restoreSessionIfPossible() async -> TokenExchangeResult? {
        guard let user = await privy.getUser() else { return nil }
        do {
            let token = try await user.getAccessToken()
            return try await tokenExchangeService.exchange(privyToken: token)
        } catch {
            return nil
        }
    }

    func restoreProfileIfPossible() async -> PrivyNativeProfile? {
        guard let user = await privy.getUser() else { return nil }
        return profileFromPrivyUser(user, fallbackProvider: .email)
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
            default:
                continue
            }
        }

        return PrivyNativeProfile(
            privyDid: user.id,
            email: email,
            name: name,
            photoUrl: nil,
            loginMethod: loginMethod
        )
    }
}
