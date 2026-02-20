import SwiftUI

struct LoadingStateView: View {
    var message: LocalizedStringKey = "Loading..."

    var body: some View {
        VStack(spacing: 10) {
            ProgressView()
                .tint(Color.botanicalAccent)
                .scaleEffect(1.05)

            Text(message)
                .font(.botanicalBody(14))
                .foregroundStyle(Color.botanicalTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .padding(.horizontal, 16)
        .botanicalCard(cornerRadius: 16)
    }
}
