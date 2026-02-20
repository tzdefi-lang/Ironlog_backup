import SwiftUI

struct CalendarView: View {
    @Environment(AppStore.self) private var store
    @State private var viewModel = CalendarViewModel()
    @State private var selectedDate = DateUtils.formatDate()
    @State private var calendarID = UUID()
    @State private var dragOffset: CGFloat = 0

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
                        HapticManager.shared.selection()
                    } label: {
                        Image(systemName: "chevron.left")
                    }
                    .accessibilityLabel("Previous month")

                    Spacer()

                    Text(monthTitle)
                        .font(.botanicalSemibold(18))

                    Spacer()

                    Button {
                        withAnimation(.easeInOut(duration: 0.28)) {
                            viewModel.nextMonth()
                            calendarID = UUID()
                        }
                        HapticManager.shared.selection()
                    } label: {
                        Image(systemName: "chevron.right")
                    }
                    .accessibilityLabel("Next month")
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
                            let isSelected = selectedDate == dayString
                            let isToday = dayString == DateUtils.formatDate()

                            Button {
                                selectedDate = dayString
                                HapticManager.shared.selection()
                            } label: {
                                VStack(spacing: 4) {
                                    Text(String(Calendar.current.component(.day, from: day)))
                                        .font(.botanicalBody(14))
                                        .foregroundStyle(isToday && !isSelected ? Color.botanicalAccent : Color.botanicalTextPrimary)
                                    Circle()
                                        .fill(hasWorkout ? Color.botanicalAccent : Color.clear)
                                        .frame(width: 5, height: 5)
                                }
                                .frame(maxWidth: .infinity, minHeight: 44)
                                .background(
                                    isSelected
                                        ? Color.botanicalAccent.opacity(0.22)
                                        : isToday
                                            ? Color.botanicalAccent.opacity(0.08)
                                            : Color.clear
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Select \(dayString)")
                        }
                    }
                    .id(calendarID)
                    .transition(.asymmetric(
                        insertion: .move(edge: viewModel.lastNavigationDirection == .forward ? .trailing : .leading),
                        removal: .move(edge: viewModel.lastNavigationDirection == .forward ? .leading : .trailing)
                    ))
                }
                .offset(x: dragOffset)
                .animation(.interactiveSpring(duration: 0.15), value: dragOffset)
                .simultaneousGesture(
                    DragGesture(minimumDistance: 20)
                        .onChanged { value in
                            guard abs(value.translation.width) > abs(value.translation.height) * 1.5 else { return }
                            dragOffset = value.translation.width * 0.4
                        }
                        .onEnded { value in
                            let horizontal = value.translation.width
                            let velocity = value.predictedEndTranslation.width
                            let isHorizontal = abs(value.translation.width) > abs(value.translation.height) * 1.5

                            if isHorizontal, (horizontal < -50 || velocity < -200) {
                                withAnimation(.easeInOut(duration: 0.28)) {
                                    viewModel.nextMonth()
                                    calendarID = UUID()
                                    dragOffset = 0
                                }
                                HapticManager.shared.selection()
                            } else if isHorizontal, (horizontal > 50 || velocity > 200) {
                                withAnimation(.easeInOut(duration: 0.28)) {
                                    viewModel.previousMonth()
                                    calendarID = UUID()
                                    dragOffset = 0
                                }
                                HapticManager.shared.selection()
                            } else {
                                withAnimation(.spring(duration: 0.2, bounce: 0.1)) {
                                    dragOffset = 0
                                }
                            }
                        }
                )

                DayWorkoutListView(
                    workouts: selectedWorkouts,
                    onOpen: { store.openWorkout(id: $0.id) },
                    onCopy: { workout, targetDate in
                        Task { await store.copyWorkout(workoutId: workout.id, targetDate: targetDate) }
                    },
                    onDelete: { workout in
                        Task { await store.deleteWorkout(id: workout.id) }
                    },
                    onStartWorkout: {
                        store.openNewWorkout()
                    }
                )
            }
            .padding(.horizontal, 24)
            .padding(.top, 20)
            .padding(.bottom, 24)
        }
        .scrollIndicators(.hidden)
        .safeAreaPadding(.top, 6)
        .refreshable {
            await store.refreshData()
        }
        .safeAreaInset(edge: .bottom) {
            Color.clear
                .frame(height: 98)
                .allowsHitTesting(false)
        }
        .background(Color.botanicalBackground.ignoresSafeArea())
    }
}
