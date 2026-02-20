import Charts
import SwiftUI

struct BodyPartPieChart: View {
    let values: [(category: String, value: Double)]

    private let colors = BotanicalTheme.chartPalette

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("BODY PART SPLIT")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.botanicalTextSecondary)
                .tracking(1.2)

            HStack(alignment: .center, spacing: 16) {
                Chart(Array(values.enumerated()), id: \.offset) { idx, item in
                    SectorMark(
                        angle: .value("Value", item.value),
                        innerRadius: .ratio(0.58),
                        angularInset: 1.2
                    )
                    .foregroundStyle(colors[idx % colors.count])
                    .cornerRadius(3)
                }
                .frame(width: 150, height: 150)

                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(values.prefix(6).enumerated()), id: \.offset) { idx, item in
                        HStack(spacing: 8) {
                            Circle()
                                .fill(colors[idx % colors.count])
                                .frame(width: 10, height: 10)
                            Text(item.category)
                                .font(.botanicalBody(13))
                                .foregroundStyle(Color.botanicalTextPrimary)
                            Spacer()
                            Text("\(Int(item.value))")
                                .font(.botanicalSemibold(13))
                                .foregroundStyle(Color.botanicalTextSecondary)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(16)
        .botanicalCard()
    }
}
