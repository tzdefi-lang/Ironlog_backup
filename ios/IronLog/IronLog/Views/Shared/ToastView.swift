import SwiftUI

struct ToastView: View {
    let message: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(Color.botanicalAccent)

            Text(message)
                .font(.botanicalSemibold(13))
                .foregroundStyle(Color.botanicalTextPrimary)
                .lineLimit(2)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color.botanicalSurface)
        .overlay(
            Capsule()
                .stroke(Color.botanicalBorderSubtle, lineWidth: 1)
        )
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.12), radius: 10, x: 0, y: 4)
    }
}
