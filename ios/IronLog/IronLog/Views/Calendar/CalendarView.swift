import SwiftUI

struct CalendarView: View {
    @Environment(AppStore.self) private var store
    @State private var viewModel = CalendarViewModel()
    @State private var selectedDate = DateUtils.formatDate()
    @State private var calendarID = UUID()

    private var monthTitle: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "LLLL yyyy"
        return formatter.string(from: viewModel.monthDate)
    }

    private var monthDays: [Date] {
        let calendar = Calendar(identifier: .gregorian)
        guard let interval = calendar.dateInterval(of: .month, for: viewModel.monthDate) else { return [] }
        var days: [Date] = []
        var cursor = interval.start
        while cursor < interval.end {
            days.append(cursor)
            cursor = calendar.date(byAdding: .day, value: 1, to: cursor) ?? cursor
        }
        return days
    }

    private var leadingBlankCount: Int {
        let calendar = Calendar(identifier: .gregorian)
        guard let firstOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: viewModel.monthDate)) else {
            return 0
        }
        return calendar.component(.weekday, from: firstOfMonth) - 1
    }

    private var selectedWorkouts: [Workout] {
        store.workouts.filter { $0.date == selectedDate }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Calendar")
                    .font(.display(40))

                HStack {
                    Button {
                        withAnimation(.easeInOut(duration: 0.28)) {
                            viewModel.previousMonth()
                            calendarID = UUID()
                        }
                    } label: {
                        Image(systemName: "chevron.left")
                    }

                    Spacer()

                    Text(monthTitle)
                        .font(.botanicalSemibold(18))

                    Spacer()

                    Button {
                        withAnimation(.easeInOut(duration: 0.28)) {
                            viewModel.nextMonth()
                            calendarID = UUID()
                        }
                    } label: {
                        Image(systemName: "chevron.right")
                    }
                }
                .buttonStyle(.plain)

                ZStack {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 7), spacing: 8) {
                        ForEach(Array(["S", "M", "T", "W", "T", "F", "S"].enumerated()), id: \.offset) { _, day in
                            Text(day)
                                .font(.caption2)
                                .foregroundStyle(Color.botanicalTextSecondary)
                        }

                        ForEach(0 ..< leadingBlankCount, id: \.self) { _ in
                            Color.clear
                                .frame(maxWidth: .infinity, minHeight: 44)
                        }

                        ForEach(monthDays, id: \.self) { day in
                            let dayString = DateUtils.formatDate(day)
                            let hasWorkout = store.workouts.contains { $0.date == dayString }

                            Button {
                                selectedDate = dayString
                            } label: {
                                VStack(spacing: 4) {
                                    Text(String(Calendar.current.component(.day, from: day)))
                                        .font(.botanicalBody(14))
                                    Circle()
                                        .fill(hasWorkout ? Color.botanicalAccent : Color.clear)
                                        .frame(width: 5, height: 5)
                                }
                                .frame(maxWidth: .infinity, minHeight: 44)
                                .background(selectedDate == dayString ? Color.botanicalAccent.opacity(0.22) : Color.botanicalSurface)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .id(calendarID)
                    .transition(.asymmetric(
                        insertion: .move(edge: viewModel.lastNavigationDirection == .forward ? .trailing : .leading),
                        removal: .move(edge: viewModel.lastNavigationDirection == .forward ? .leading : .trailing)
                    ))
                }

                DayWorkoutListView(
                    workouts: selectedWorkouts,
                    onOpen: { store.openWorkout(id: $0.id) },
                    onCopy: { workout in
                        Task { await store.copyWorkout(workoutId: workout.id, targetDate: selectedDate) }
                    },
                    onDelete: { workout in
                        Task { await store.deleteWorkout(id: workout.id) }
                    }
                )
            }
            .padding(.horizontal, 24)
            .padding(.top, 20)
            .padding(.bottom, 24)
        }
        .safeAreaPadding(.top, 6)
        .safeAreaInset(edge: .bottom) {
            Color.clear
                .frame(height: 98)
                .allowsHitTesting(false)
        }
        .background(Color.botanicalBackground.ignoresSafeArea())
    }
}
