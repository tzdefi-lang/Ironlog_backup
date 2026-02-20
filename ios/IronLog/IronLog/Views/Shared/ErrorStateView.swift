import SwiftUI

struct ErrorStateView: View {
    let title: LocalizedStringKey
    let message: LocalizedStringKey
    var retryTitle: LocalizedStringKey = "Retry"
    var onRetry: (() -> Void)?

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(Color.botanicalDanger)

            Text(title)
                .font(.botanicalSemibold(17))
                .foregroundStyle(Color.botanicalTextPrimary)
                .multilineTextAlignment(.center)

            Text(message)
                .font(.botanicalBody(14))
                .foregroundStyle(Color.botanicalTextSecondary)
                .multilineTextAlignment(.center)

            if let onRetry {
                Button {
                    onRetry()
                } label: {
                    Text(retryTitle)
                        .font(.botanicalSemibold(14))
                        .foregroundStyle(Color.botanicalDangerLight)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Color.botanicalDanger)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .padding(.horizontal, 16)
        .botanicalCard(cornerRadius: 16)
    }
}
