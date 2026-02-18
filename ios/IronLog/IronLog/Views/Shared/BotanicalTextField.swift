import SwiftUI

struct BotanicalTextField: View {
    let title: String
    @Binding var value: String

    var body: some View {
        TextField(title, text: $value)
            .textFieldStyle(.plain)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.botanicalSurface)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color.botanicalBorderSubtle, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
