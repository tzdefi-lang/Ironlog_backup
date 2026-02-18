import SwiftUI
import UIKit

struct SessionReportView: View {
    let workout: Workout
    let durationMinutes: Int
    let completion: Int
    let volume: Int
    let prBreaks: [PRBreak]
    let onClose: () -> Void

    @State private var animatedDuration = 0.0
    @State private var animatedCompletion = 0.0
    @State private var animatedVolume = 0.0
    @State private var shareImage: UIImage?
    @State private var showShareSheet = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    HStack {
                        Text("Workout Complete")
                            .font(.display(36))

                        Spacer()

                        Button {
                            generateShareImage()
                        } label: {
                            Image(systemName: "square.and.arrow.up")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(Color.botanicalAccent)
                                .frame(width: 38, height: 38)
                                .background(Color.botanicalSurface)
                                .clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                    }

                    BotanicalCard {
                        VStack(alignment: .leading, spacing: 8) {
                            reportRow("Duration", "\(Int(animatedDuration.rounded())) min")
                            reportRow("Completion", "\(Int(animatedCompletion.rounded()))%")
                            reportRow("Volume", "\(Int(animatedVolume.rounded()))")
                        }
                    }

                    if prBreaks.isEmpty {
                        Text("No PR broken this session")
                            .font(.botanicalBody(14))
                            .foregroundStyle(Color.botanicalTextSecondary)
                    } else {
                        BotanicalCard {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Personal Records")
                                    .font(.botanicalSemibold(16))

                                ForEach(prBreaks) { item in
                                    HStack {
                                        Image(systemName: "trophy.fill")
                                            .foregroundStyle(.yellow)
                                        Text(item.exerciseName)
                                            .font(.botanicalSemibold(14))
                                        Spacer()
                                        Text("\(item.metric.rawValue): \(Int(item.previous))→\(Int(item.current))")
                                            .font(.botanicalBody(13))
                                            .foregroundStyle(Color.botanicalTextSecondary)
                                    }
                                    .padding(10)
                                    .background(Color.botanicalEmphasis.opacity(0.1))
                                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                }
                            }
                        }
                    }

                    BotanicalButton(title: "Back to Home", variant: .primary, action: onClose)
                }
                .padding(24)
            }
            .background(Color.botanicalBackground.ignoresSafeArea())
            .onAppear {
                animatedDuration = 0
                animatedCompletion = 0
                animatedVolume = 0

                withAnimation(.easeOut(duration: 1.2)) {
                    animatedDuration = Double(durationMinutes)
                    animatedCompletion = Double(completion)
                    animatedVolume = Double(volume)
                }
            }
        }
        .sheet(isPresented: $showShareSheet) {
            if let shareImage {
                ActivityView(activityItems: [shareImage])
            }
        }
    }

    private func reportRow(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .font(.botanicalBody(15))
            Spacer()
            Text(value)
                .font(.botanicalSemibold(16))
        }
    }

    private func generateShareImage() {
        let renderer = ImageRenderer(content: shareCard)
        renderer.scale = UIScreen.main.scale
        if let image = renderer.uiImage {
            shareImage = image
            showShareSheet = true
        }
    }

    private var shareCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("IronLog")
                .font(.display(14))
                .foregroundStyle(Color.botanicalTextSecondary)

            Text(workout.title)
                .font(.display(28))

            HStack(spacing: 20) {
                statChip("⏱", "\(durationMinutes)min")
                statChip("✓", "\(completion)%")
                statChip("🏋️", "\(volume)")
            }

            if !prBreaks.isEmpty {
                Text("🏆 \(prBreaks.count) PR broken!")
                    .font(.botanicalSemibold(14))
            }
        }
        .padding(24)
        .frame(width: 320, alignment: .leading)
        .background(Color.botanicalSurface)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private func statChip(_ icon: String, _ text: String) -> some View {
        HStack(spacing: 6) {
            Text(icon)
            Text(text)
                .font(.botanicalSemibold(13))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.botanicalMuted)
        .clipShape(Capsule())
    }
}

private struct ActivityView: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
