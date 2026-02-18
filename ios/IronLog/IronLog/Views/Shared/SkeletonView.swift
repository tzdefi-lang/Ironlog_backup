import SwiftUI

struct SkeletonView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            RoundedRectangle(cornerRadius: 8).fill(Color.botanicalMuted).frame(height: 28)
            RoundedRectangle(cornerRadius: 8).fill(Color.botanicalMuted.opacity(0.8)).frame(height: 20)
            RoundedRectangle(cornerRadius: 16).fill(Color.botanicalMuted).frame(height: 140)
        }
        .redacted(reason: .placeholder)
        .shimmering()
    }
}

private struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = -1.2

    func body(content: Content) -> some View {
        content
            .overlay {
                LinearGradient(colors: [.clear, .white.opacity(0.35), .clear], startPoint: .leading, endPoint: .trailing)
                    .rotationEffect(.degrees(8))
                    .offset(x: phase * 380)
            }
            .mask(content)
            .onAppear {
                withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                    phase = 1.2
                }
            }
    }
}

private extension View {
    func shimmering() -> some View {
        modifier(ShimmerModifier())
    }
}
