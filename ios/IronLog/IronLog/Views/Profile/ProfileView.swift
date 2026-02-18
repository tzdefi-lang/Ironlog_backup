import SwiftUI

struct ProfileView: View {
    @Environment(AppStore.self) private var store
    @State private var showSettings = false
    @State private var showHistory = false
    @State private var showManage = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Profile")
                    .font(.display(40))

                BotanicalCard {
                    HStack(spacing: 12) {
                        Circle()
                            .fill(Color.botanicalAccent.opacity(0.4))
                            .frame(width: 70, height: 70)
                            .overlay(Text(initials).font(.botanicalSemibold(24)))

                        VStack(alignment: .leading, spacing: 4) {
                            Text(store.user?.name.isEmpty == false ? store.user?.name ?? "User" : "User")
                                .font(.botanicalSemibold(18))
                            Text(store.user?.email.isEmpty == false ? store.user?.email ?? "" : "No email")
                                .font(.botanicalBody(13))
                                .foregroundStyle(Color.botanicalTextSecondary)
                        }
                    }
                }

                actionRow("History") { showHistory = true }
                actionRow("Settings") { showSettings = true }

                if store.isAdmin {
                    actionRow("Manage") { showManage = true }
                }

                BotanicalButton(title: "Sign Out", variant: .danger) {
                    Task { await store.logout() }
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 20)
            .padding(.bottom, 120)
        }
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

    private func actionRow(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
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
    }
}
