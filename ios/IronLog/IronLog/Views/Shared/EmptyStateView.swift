import SwiftUI

struct EmptyStateView: View {
    let icon: String
    let title: LocalizedStringKey
    let description: LocalizedStringKey
    var actionTitle: LocalizedStringKey?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(Color.botanicalMuted)

            Text(title)
                .font(.botanicalSemibold(17))
                .foregroundStyle(Color.botanicalTextPrimary)
                .multilineTextAlignment(.center)

            Text(description)
                .font(.botanicalBody(14))
                .foregroundStyle(Color.botanicalTextSecondary)
                .multilineTextAlignment(.center)

            if let actionTitle, let action {
                Button {
                    action()
                } label: {
                    Text(actionTitle)
                        .font(.botanicalSemibold(14))
                        .foregroundStyle(Color.botanicalTextPrimary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(Color.botanicalAccent)
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
