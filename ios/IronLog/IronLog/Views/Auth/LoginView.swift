import SwiftUI

struct LoginView: View {
    @Environment(AppStore.self) private var store

    enum LoginStep: Equatable {
        case initial
        case emailEntry
        case otpEntry(String)
    }

    @State private var loginStep: LoginStep = .initial
    @State private var emailInput = ""
    @State private var otpInput = ""
    @State private var isEmailSending = false
    @State private var fallbackToken = ""
    @State private var showDevFallback = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 8) {
                Text("IronLog")
                    .font(.display(52))
                    .foregroundStyle(Color.botanicalTextPrimary)
                Text("auth.login.subtitle")
                    .font(.botanicalBody(16))
                    .foregroundStyle(Color.botanicalTextSecondary)
            }
            .padding(.bottom, 48)

            if let error = store.authError, !error.isEmpty {
                Text(error)
                    .font(.botanicalBody(13))
                    .foregroundStyle(.red)
                    .padding(12)
                    .background(Color.red.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .padding(.bottom, 16)
                    .padding(.horizontal, 4)
            }

            switch loginStep {
            case .initial:
                VStack(spacing: 12) {
                    oauthButton(
                        icon: "g.circle.fill",
                        title: "auth.login.continueGoogle",
                        color: Color(hex: "#4285F4"),
                        disabled: store.isLoading
                    ) {
                        Task { await store.loginWithPrivy(provider: .google) }
                    }

                    oauthButton(
                        icon: "apple.logo",
                        title: "auth.login.continueApple",
                        color: Color.botanicalTextPrimary,
                        disabled: store.isLoading
                    ) {
                        Task { await store.loginWithPrivy(provider: .apple) }
                    }

                    HStack {
                        Rectangle().fill(Color.botanicalBorderSubtle).frame(height: 1)
                        Text("or")
                            .font(.botanicalBody(13))
                            .foregroundStyle(Color.botanicalTextSecondary)
                            .padding(.horizontal, 12)
                        Rectangle().fill(Color.botanicalBorderSubtle).frame(height: 1)
                    }

                    oauthButton(
                        icon: "envelope.fill",
                        title: "auth.login.continueEmail",
                        color: Color.botanicalAccent,
                        disabled: store.isLoading
                    ) {
                        withAnimation(.easeOut(duration: 0.25)) {
                            loginStep = .emailEntry
                            store.authError = nil
                        }
                    }
                }

            case .emailEntry:
                VStack(spacing: 16) {
                    Text("auth.login.enterEmail")
                        .font(.botanicalSemibold(18))
                        .foregroundStyle(Color.botanicalTextPrimary)

                    BotanicalTextField(title: "auth.login.emailAddress", value: $emailInput)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                    BotanicalButton(
                        title: isEmailSending
                            ? LocalizedStringKey("auth.login.sending")
                            : LocalizedStringKey("auth.login.sendCode"),
                        variant: .primary,
                        disabled: emailInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isEmailSending
                    ) {
                        let email = emailInput.trimmingCharacters(in: .whitespacesAndNewlines)
                        isEmailSending = true
                        Task {
                            await store.sendEmailOTP(to: email)
                            isEmailSending = false
                            if store.authError == nil {
                                withAnimation(.easeOut(duration: 0.25)) {
                                    loginStep = .otpEntry(email)
                                }
                            }
                        }
                    }

                    Button("auth.login.back") {
                        withAnimation(.easeOut(duration: 0.25)) {
                            loginStep = .initial
                            store.authError = nil
                        }
                    }
                    .font(.botanicalBody(14))
                    .foregroundStyle(Color.botanicalTextSecondary)
                }

            case .otpEntry(let email):
                VStack(spacing: 16) {
                    Text("auth.login.checkEmail")
                        .font(.botanicalSemibold(18))
                        .foregroundStyle(Color.botanicalTextPrimary)

                    (Text("auth.login.codeSentPrefix") + Text(" \(email)"))
                        .font(.botanicalBody(14))
                        .foregroundStyle(Color.botanicalTextSecondary)
                        .multilineTextAlignment(.center)

                    BotanicalTextField(title: "auth.login.codePlaceholder", value: $otpInput)
                        .keyboardType(.numberPad)

                    BotanicalButton(
                        title: store.isLoading
                            ? LocalizedStringKey("auth.login.verifying")
                            : LocalizedStringKey("auth.login.verify"),
                        variant: .primary,
                        disabled: otpInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.isLoading
                    ) {
                        Task {
                            await store.verifyEmailOTP(
                                code: otpInput.trimmingCharacters(in: .whitespacesAndNewlines),
                                email: email
                            )
                        }
                    }

                    Button("auth.login.resendCode") {
                        Task { await store.sendEmailOTP(to: email) }
                    }
                    .font(.botanicalBody(14))
                    .foregroundStyle(Color.botanicalAccent)

                    Button("auth.login.back") {
                        withAnimation(.easeOut(duration: 0.25)) {
                            loginStep = .emailEntry
                            otpInput = ""
                            store.authError = nil
                        }
                    }
                    .font(.botanicalBody(14))
                    .foregroundStyle(Color.botanicalTextSecondary)
                }
            }

            Spacer()

            #if DEBUG
            disclosureGroupDevFallback
            #endif
        }
        .padding(28)
        .background(Color.botanicalBackground.ignoresSafeArea())
    }

    private func oauthButton(
        icon: String,
        title: LocalizedStringKey,
        color: Color,
        disabled: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(color)
                    .frame(width: 24)
                Text(title)
                    .font(.botanicalSemibold(16))
                    .foregroundStyle(Color.botanicalTextPrimary)
                Spacer()
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 20)
            .frame(height: 52)
            .background(Color.botanicalSurface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.botanicalBorderSubtle, lineWidth: 1)
            )
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(disabled)
    }

    private var disclosureGroupDevFallback: some View {
        DisclosureGroup(isExpanded: $showDevFallback) {
            VStack(alignment: .leading, spacing: 10) {
                BotanicalTextField(title: "auth.login.pasteToken", value: $fallbackToken)

                BotanicalButton(
                    title: "auth.login.useToken",
                    variant: .secondary,
                    disabled: fallbackToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.isLoading
                ) {
                    let token = fallbackToken.trimmingCharacters(in: .whitespacesAndNewlines)
                    Task { await store.login(withPrivyToken: token) }
                }
            }
            .padding(.top, 8)
        } label: {
            Text("auth.login.devPasteToken")
                .font(.system(size: 11))
                .foregroundStyle(Color.botanicalTextSecondary)
        }
        .tint(Color.botanicalTextSecondary)
    }
}
