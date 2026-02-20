import SwiftUI

struct ProfileView: View {
    @Environment(AppStore.self) private var store
    @State private var showSettings = false
    @State private var showHistory = false
    @State private var showManage = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("profile.title")
                    .font(.display(40))

                BotanicalCard {
                    HStack(spacing: 12) {
                        Circle()
                            .fill(Color.botanicalAccent.opacity(0.4))
                            .frame(width: 70, height: 70)
                            .overlay(Text(initials).font(.botanicalSemibold(24)))

                        VStack(alignment: .leading, spacing: 4) {
                            if let name = store.user?.name.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty {
                                Text(name)
                                    .font(.botanicalSemibold(18))
                            } else {
                                Text("profile.defaultUser")
                                    .font(.botanicalSemibold(18))
                            }

                            if let email = store.user?.email.trimmingCharacters(in: .whitespacesAndNewlines), !email.isEmpty {
                                Text(email)
                                    .font(.botanicalBody(13))
                                    .foregroundStyle(Color.botanicalTextSecondary)
                            } else {
                                Text("profile.noEmail")
                                    .font(.botanicalBody(13))
                                    .foregroundStyle(Color.botanicalTextSecondary)
                            }
                        }
                    }
                }

                actionRow("history.title", identifier: "profile.historyRow") { showHistory = true }
                actionRow("profile.settings") { showSettings = true }

                if store.isAdmin {
                    actionRow("profile.manageOfficialTitle") { showManage = true }
                }

                BotanicalButton(title: "common.signOut", variant: .danger) {
                    Task { await store.logout() }
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 20)
            .padding(.bottom, 120)
        }
        .scrollIndicators(.hidden)
        .background(Color.botanicalBackground.ignoresSafeArea())
        .navigationDestination(isPresented: $showSettings) {
            ProfileSettingsView()
        }
        .navigationDestination(isPresented: $showHistory) {
            HistoryView()
        }
        .navigationDestination(isPresented: $showManage) {
            ManageView()
        }
    }

    private var initials: String {
        let name = store.user?.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let name, !name.isEmpty else { return "U" }
        return name.split(separator: " ").prefix(2).compactMap { $0.first }.map(String.init).joined()
    }

    @ViewBuilder
    private func actionRow(
        _ title: LocalizedStringKey,
        identifier: String? = nil,
        action: @escaping () -> Void
    ) -> some View {
        let button = Button(action: action) {
            HStack {
                Text(title)
                    .font(.botanicalSemibold(16))
                    .foregroundStyle(Color.botanicalTextPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(Color.botanicalTextSecondary)
            }
            .padding(16)
                .botanicalCard()
        }
        .buttonStyle(.plain)

        if let identifier {
            button.accessibilityIdentifier(identifier)
        } else {
            button
        }
    }
}
