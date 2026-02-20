import SwiftUI

struct CustomTabBar: View {
    @Binding var selectedTab: MainTabView.Tab
    var onReselect: ((MainTabView.Tab) -> Void)?
    var onNewWorkout: () -> Void

    var body: some View {
        HStack(spacing: 18) {
            tabButton("house.fill", tab: .dashboard)
            tabButton("calendar", tab: .calendar)

            Button(action: onNewWorkout) {
                Image(systemName: "plus")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Color.botanicalTextPrimary)
                    .frame(width: 52, height: 52)
                    .background(Color.botanicalEmphasis)
                    .clipShape(Circle())
                    .shadow(color: .black.opacity(0.18), radius: 12, x: 0, y: 6)
            }
            .simultaneousGesture(TapGesture().onEnded { HapticManager.shared.medium() })
            .buttonStyle(PressableButtonStyle())
            .accessibilityLabel("Start new workout")
            .accessibilityIdentifier("tabbar.newWorkoutButton")

            tabButton("chart.bar.fill", tab: .stats)
            tabButton("person.fill", tab: .profile)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(Color.botanicalBorderSubtle, lineWidth: 1))
    }

    private func tabButton(_ icon: String, tab: MainTabView.Tab) -> some View {
        Button {
            if selectedTab == tab {
                // Already on this tab — pop to root
                onReselect?(tab)
            } else {
                withAnimation(.spring(duration: 0.3, bounce: 0.2)) {
                    selectedTab = tab
                }
            }
            HapticManager.shared.selection()
        } label: {
            Image(systemName: iconName(base: icon, selected: selectedTab == tab))
                .font(.system(size: 20, weight: selectedTab == tab ? .bold : .regular))
                .foregroundStyle(selectedTab == tab ? Color.botanicalTextPrimary : Color.botanicalTextSecondary)
                .frame(width: 44, height: 44)
                .background(
                    Circle()
                        .fill(selectedTab == tab ? Color.botanicalAccent.opacity(0.2) : Color.clear)
                        .scaleEffect(selectedTab == tab ? 1.0 : 0.0)
                )
                .animation(.spring(duration: 0.3, bounce: 0.25), value: selectedTab)
        }
        .buttonStyle(PressableButtonStyle())
        .accessibilityLabel(tabAccessibilityLabel(tab))
    }

    private func iconName(base: String, selected: Bool) -> String {
        guard !selected, base.contains(".fill") else { return base }
        return base.replacingOccurrences(of: ".fill", with: "")
    }

    private func tabAccessibilityLabel(_ tab: MainTabView.Tab) -> String {
        switch tab {
        case .dashboard:
            return "Dashboard"
        case .calendar:
            return "Calendar"
        case .stats:
            return "Stats"
        case .profile:
            return "Profile"
        }
    }
}
