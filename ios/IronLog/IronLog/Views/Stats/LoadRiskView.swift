import Charts
import SwiftUI

struct LoadRiskView: View {
    let insight: LoadInsight
    let trendPoints: [(label: String, volume: Double, baseline: Double, isCurrent: Bool)]

    private var statusColor: Color {
        switch insight.level {
        case .high:
            return .botanicalDanger
        case .elevated:
            return Color.botanicalEmphasis
        case .low:
            return .botanicalInfo
        case .normal:
            return Color.botanicalSuccess
        case .insufficient:
            return Color.botanicalTextSecondary
        }
    }

    private var statusLabel: String {
        switch insight.level {
        case .high:
            return "High Risk"
        case .elevated:
            return "Elevated"
        case .low:
            return "Low"
        case .normal:
            return "Normal"
        case .insufficient:
            return "Insufficient Data"
        }
    }

    private var adviceText: String {
        switch insight.level {
        case .high:
            return "This week's load is significantly above baseline. Consider reducing intensity."
        case .elevated:
            return "Training load is elevated. Monitor fatigue and recovery closely."
        case .low:
            return "Training load is below baseline. Consider gradually increasing volume."
        case .normal:
            return "Load is progressing well within safe limits."
        case .insufficient:
            return "Train at least 3 weeks consistently to see load analysis."
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("TRAINING LOAD")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.botanicalTextSecondary)
                        .tracking(1.2)
                    Text("Acute vs Baseline Workload")
                        .font(.botanicalBody(12))
                        .foregroundStyle(Color.botanicalTextSecondary)
                }
                Spacer()
                Text(statusLabel.uppercased())
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(statusColor)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(statusColor.opacity(0.12))
                    .clipShape(Capsule())
            }

            Text(adviceText)
                .font(.botanicalBody(13))
                .foregroundStyle(Color.botanicalTextPrimary)

            HStack(spacing: 8) {
                statMiniCard("Acute", value: formatVolume(insight.acuteVolume))
                statMiniCard("Baseline", value: formatVolume(insight.baselineVolume))
                statMiniCard("Ratio", value: insight.ratio.map { String(format: "%.2f", $0) } ?? "—")
            }

            if !trendPoints.isEmpty {
                Chart {
                    ForEach(trendPoints, id: \.label) { point in
                        BarMark(
                            x: .value("Week", point.label),
                            y: .value("Volume", point.volume)
                        )
                        .foregroundStyle(
                            point.isCurrent
                                ? Color.botanicalEmphasis
                                : Color.botanicalAccent.opacity(0.7)
                        )
                        .cornerRadius(5)
                    }

                    ForEach(trendPoints, id: \.label) { point in
                        LineMark(
                            x: .value("Week", point.label),
                            y: .value("Baseline", point.baseline)
                        )
                        .foregroundStyle(Color.botanicalTextSecondary.opacity(0.6))
                        .lineStyle(StrokeStyle(lineWidth: 2, dash: [5, 4]))
                        .interpolationMethod(.monotone)
                    }
                }
                .chartXAxis {
                    AxisMarks(values: .automatic) { _ in
                        AxisValueLabel().font(.botanicalBody(10))
                    }
                }
                .chartYAxis {
                    AxisMarks(values: .automatic) { _ in
                        AxisValueLabel().font(.botanicalBody(10))
                        AxisGridLine()
                    }
                }
                .frame(height: 160)

                HStack(spacing: 16) {
                    legendDot(color: Color.botanicalAccent, label: "Weekly Volume")
                    legendDash(color: Color.botanicalTextSecondary, label: "Baseline (4w avg)")
                }
                .font(.botanicalBody(11))
                .foregroundStyle(Color.botanicalTextSecondary)
            }
        }
        .padding(16)
        .botanicalCard()
    }

    private func statMiniCard(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color.botanicalTextSecondary)
                .tracking(0.8)
            Text(value)
                .font(.botanicalSemibold(14))
                .foregroundStyle(Color.botanicalTextPrimary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.botanicalBackground.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private func legendDot(color: Color, label: String) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(label)
        }
    }

    private func legendDash(color: Color, label: String) -> some View {
        HStack(spacing: 5) {
            Rectangle()
                .fill(color)
                .frame(width: 14, height: 2)
                .overlay(
                    HStack(spacing: 3) {
                        ForEach(0 ..< 2, id: \.self) { _ in
                            Rectangle()
                                .fill(Color.botanicalBackground)
                                .frame(width: 3, height: 2)
                        }
                    }
                )
            Text(label)
        }
    }

    private func formatVolume(_ value: Double) -> String {
        value >= 1000 ? String(format: "%.1fk", value / 1000) : "\(Int(value))"
    }
}
