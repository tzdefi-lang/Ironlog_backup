import Charts
import SwiftUI

struct WorkoutDurationChart: View {
    let points: [(label: String, date: String, minutes: Int)]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("WORKOUT DURATION")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.botanicalTextSecondary)
                .tracking(1.2)

            if points.isEmpty {
                Text("No elapsed time recorded")
                    .font(.botanicalBody(14))
                    .foregroundStyle(Color.botanicalTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 32)
            } else {
                Chart(points, id: \.label) { point in
                    BarMark(
                        x: .value("Session", point.label),
                        y: .value("Minutes", point.minutes)
                    )
                    .foregroundStyle(Color.botanicalAccent)
                    .cornerRadius(5)
                    .annotation(position: .top, alignment: .center) {
                        if point.minutes > 0 {
                            Text("\(point.minutes)m")
                                .font(.system(size: 9, weight: .medium))
                                .foregroundStyle(Color.botanicalTextSecondary)
                        }
                    }
                }
                .chartXAxis {
                    AxisMarks(values: .automatic) { _ in
                        AxisValueLabel().font(.botanicalBody(10))
                    }
                }
                .chartYAxis {
                    AxisMarks(values: .automatic(desiredCount: 4)) { value in
                        AxisValueLabel {
                            if let v = value.as(Int.self) {
                                Text("\(v)m").font(.botanicalBody(10))
                            }
                        }
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
