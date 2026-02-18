import Charts
import SwiftUI

struct OneRMTrendChart: View {
    let points: [(label: String, oneRM: Double)]

    var body: some View {
        Chart(points, id: \.label) { item in
            LineMark(
                x: .value("Date", item.label),
                y: .value("1RM", item.oneRM)
            )
            .foregroundStyle(Color.botanicalEmphasis)
            .symbol(.circle)
        }
        .frame(height: 220)
    }
}
