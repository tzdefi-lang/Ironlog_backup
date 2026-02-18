import Charts
import SwiftUI

struct WeeklyVolumeChart: View {
    let points: [(label: String, volume: Double)]

    var body: some View {
        Chart(points, id: \.label) { point in
            BarMark(
                x: .value("Week", point.label),
                y: .value("Volume", point.volume)
            )
            .foregroundStyle(Color.botanicalAccent)
            .cornerRadius(6)
        }
        .frame(height: 220)
    }
}
