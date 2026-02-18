import Charts
import SwiftUI

struct WeeklyFrequencyChart: View {
    let points: [(label: String, count: Int)]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("WEEKLY FREQUENCY")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.botanicalTextSecondary)
                .tracking(1.2)

            if points.allSatisfy({ $0.count == 0 }) {
                Text("No completed workouts yet")
                    .font(.botanicalBody(14))
                    .foregroundStyle(Color.botanicalTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 32)
            } else {
                Chart(points, id: \.label) { point in
                    LineMark(
                        x: .value("Week", point.label),
                        y: .value("Workouts", point.count)
                    )
                    .foregroundStyle(Color.botanicalAccent)
                    .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round))
                    .interpolationMethod(.monotone)

                    AreaMark(
                        x: .value("Week", point.label),
                        y: .value("Workouts", point.count)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color.botanicalAccent.opacity(0.25), Color.botanicalAccent.opacity(0)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .interpolationMethod(.monotone)

                    PointMark(
                        x: .value("Week", point.label),
                        y: .value("Workouts", point.count)
                    )
                    .foregroundStyle(Color.botanicalAccent)
                    .symbolSize(28)
                }
                .chartXAxis {
                    AxisMarks(values: .automatic) { _ in
                        AxisValueLabel().font(.botanicalBody(10))
                    }
                }
                .chartYAxis {
                    AxisMarks(values: .automatic(desiredCount: 4)) { _ in
                        AxisValueLabel().font(.botanicalBody(10))
                        AxisGridLine()
                    }
                }
                .frame(height: 180)
            }
        }
        .padding(16)
        .botanicalCard()
    }
}
