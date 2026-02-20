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
    @State private var popToRootToken = 0

    var body: some View {
        ZStack(alignment: .bottom) {
            ZStack {
                tabLayer(.dashboard)
                tabLayer(.calendar)
                tabLayer(.stats)
                tabLayer(.profile)
            }
            .animation(.easeInOut(duration: 0.2), value: selectedTab)

            // Toast floats above content without blocking interaction
            if let toast = store.activeToast {
                VStack {
                    Spacer()
                    ToastView(message: toast.message)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .onTapGesture {
                            store.dismissToast()
                        }
                        .padding(.bottom, 90)
                }
                .allowsHitTesting(false)
            }

            VStack {
                Spacer()
                CustomTabBar(selectedTab: $selectedTab, onReselect: handleReselect) {
                    store.openNewWorkout()
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 10)
            }
        }
        .animation(.easeOut(duration: 0.2), value: store.activeToast?.id)
        .background(Color.botanicalBackground.ignoresSafeArea())
        .fullScreenCover(
            isPresented: Binding(
                get: { store.showWorkoutEditor },
                set: { store.showWorkoutEditor = $0 }
            )
        ) {
            NavigationStack {
                WorkoutEditorView(workoutId: store.activeWorkoutID)
            }
            .environment(store)
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
            NavigationStack { ProfileView(popToRootToken: popToRootToken) }
        }
    }

    private func tabLayer(_ tab: Tab) -> some View {
        tabContent(tab)
            .opacity(selectedTab == tab ? 1 : 0)
            .transition(.opacity)
            .allowsHitTesting(selectedTab == tab)
    }

    private func handleReselect(_ tab: Tab) {
        popToRootToken += 1
    }
}
