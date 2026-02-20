import AudioToolbox
import SwiftUI

struct RestTimerView: View {
    let durationSeconds: Int
    let restartToken: Int
    let onClose: () -> Void
    let onDurationChange: (Int) -> Void

    @State private var remaining = 0
    @State private var task: Task<Void, Never>?
    @State private var sliderValue: Double = 90

    private let sliderRange: ClosedRange<Double> = 10...300

    private var progress: Double {
        durationSeconds > 0 ? Double(remaining) / Double(durationSeconds) : 0
    }

    var body: some View {
        ZStack {
            Color.botanicalBackground.ignoresSafeArea()

            VStack(spacing: 28) {
                Text("Rest Timer")
                    .font(.display(28))
                    .foregroundStyle(Color.botanicalTextPrimary)

                ZStack {
                    Circle()
                        .stroke(Color.botanicalMuted, lineWidth: 12)
                        .frame(width: 220, height: 220)

                    Circle()
                        .trim(from: 0, to: progress)
                        .stroke(
                            Color.botanicalAccent,
                            style: StrokeStyle(lineWidth: 12, lineCap: .round)
                        )
                        .frame(width: 220, height: 220)
                        .rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 1.0), value: progress)

                    VStack(spacing: 4) {
                        Text(DateUtils.formatDuration(Double(remaining)))
                            .font(.system(size: 52, weight: .bold, design: .rounded))
                            .foregroundStyle(Color.botanicalTextPrimary)
                            .contentTransition(.numericText())

                        Text("remaining")
                            .font(.botanicalBody(14))
                            .foregroundStyle(Color.botanicalTextSecondary)
                    }
                }

                // Duration slider
                VStack(spacing: 8) {
                    HStack {
                        Text("\(Int(sliderRange.lowerBound))s")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color.botanicalTextSecondary)
                        Spacer()
                        Text("\(Int(sliderValue))s")
                            .font(.botanicalSemibold(15))
                            .foregroundStyle(Color.botanicalAccent)
                            .contentTransition(.numericText())
                        Spacer()
                        Text("\(Int(sliderRange.upperBound))s")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color.botanicalTextSecondary)
                    }

                    Slider(value: $sliderValue, in: sliderRange, step: 5) { editing in
                        if !editing {
                            let newDuration = Int(sliderValue)
                            onDurationChange(newDuration)
                            restart(duration: newDuration)
                            HapticManager.shared.selection()
                        }
                    }
                    .tint(Color.botanicalAccent)
                }
                .padding(.horizontal, 8)

                HStack(spacing: 8) {
                    ForEach([30, 60, 90, 120, 180], id: \.self) { sec in
                        Button("\(sec)s") {
                            sliderValue = Double(sec)
                            onDurationChange(sec)
                            restart(duration: sec)
                            HapticManager.shared.selection()
                        }
                        .font(.botanicalSemibold(13))
                        .foregroundStyle(durationSeconds == sec ? Color.botanicalTextPrimary : Color.botanicalTextSecondary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 12)
                        .background(durationSeconds == sec ? Color.botanicalAccent : Color.botanicalMuted.opacity(0.6))
                        .clipShape(Capsule())
                        .animation(.easeOut(duration: 0.22), value: durationSeconds)
                        .accessibilityLabel("Set timer to \(sec) seconds")
                    }
                }

                BotanicalButton(title: "Done", variant: .primary) {
                    HapticManager.shared.success()
                    onClose()
                }
                .frame(maxWidth: 200)
            }
            .padding(32)
        }
        .onAppear {
            sliderValue = Double(durationSeconds)
            restart(duration: durationSeconds)
        }
        .onChange(of: restartToken) { _, _ in
            sliderValue = Double(durationSeconds)
            restart(duration: durationSeconds)
        }
        .onChange(of: durationSeconds) { _, newValue in
            sliderValue = Double(newValue)
            restart(duration: newValue)
        }
        .onDisappear { task?.cancel() }
    }

    private func restart(duration: Int) {
        task?.cancel()
        remaining = max(0, duration)

        task = Task {
            while !Task.isCancelled, remaining > 0 {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { return }

                remaining = max(0, remaining - 1)
                if remaining > 0 {
                    HapticManager.shared.light()
                }
            }

            guard !Task.isCancelled else { return }
            HapticManager.shared.success()
            AudioServicesPlaySystemSound(1007)
            onClose()
        }
    }
}
