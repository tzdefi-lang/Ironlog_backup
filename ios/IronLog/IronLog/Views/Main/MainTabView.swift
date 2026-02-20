import SwiftUI

struct MainTabView: View {
    enum Tab {
        case dashboard
        case calendar
        case stats
        case profile
    }

    @Environment(AppStore.self) private var store
    @State private var selectedTab: Tab = .dashboard

    var body: some View {
        ZStack(alignment: .bottom) {
            ZStack {
                tabLayer(.dashboard)
                tabLayer(.calendar)
                tabLayer(.stats)
                tabLayer(.profile)
            }
            .animation(.easeInOut(duration: 0.2), value: selectedTab)

            VStack(spacing: 10) {
                if let toast = store.activeToast {
                    ToastView(message: toast.message)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .onTapGesture {
                            store.dismissToast()
                        }
                }

                CustomTabBar(selectedTab: $selectedTab) {
                    store.openNewWorkout()
                }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 10)
        }
        .animation(.easeOut(duration: 0.2), value: store.activeToast?.id)
        .background(Color.botanicalBackground.ignoresSafeArea())
        .sheet(
            isPresented: Binding(
                get: { store.showWorkoutEditor },
                set: { store.showWorkoutEditor = $0 }
            )
        ) {
            NavigationStack {
                WorkoutEditorView(workoutId: store.activeWorkoutID)
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
    }

    @ViewBuilder
    private func tabContent(_ tab: Tab) -> some View {
        switch tab {
        case .dashboard:
            NavigationStack { DashboardView() }
        case .calendar:
            NavigationStack { CalendarView() }
        case .stats:
            NavigationStack { StatsView() }
        case .profile:
            NavigationStack { ProfileView() }
        }
    }

    private func tabLayer(_ tab: Tab) -> some View {
        tabContent(tab)
            .opacity(selectedTab == tab ? 1 : 0)
            .transition(.opacity)
            .allowsHitTesting(selectedTab == tab)
    }
}
