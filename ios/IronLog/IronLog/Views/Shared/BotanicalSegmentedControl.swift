import SwiftUI

struct BotanicalSegmentedControl<Option: Hashable>: View {
    let options: [Option]
    @Binding var selection: Option
    let title: (Option) -> String

    var body: some View {
        HStack(spacing: 8) {
            ForEach(options, id: \.self) { option in
                let isSelected = selection == option
                Button {
                    withAnimation(BotanicalMotion.quick) {
                        selection = option
                    }
                } label: {
                    Text(title(option))
                        .font(.botanicalSemibold(14))
                        .foregroundStyle(isSelected ? Color.botanicalTextPrimary : Color.botanicalTextSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 40)
                        .background(isSelected ? Color.botanicalAccent : Color.botanicalMuted.opacity(0.6))
                        .clipShape(RoundedRectangle(cornerRadius: BotanicalTheme.controlCornerRadius, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(6)
        .background(Color.botanicalSurface)
        .overlay(
            RoundedRectangle(cornerRadius: BotanicalTheme.controlCornerRadius + 6, style: .continuous)
                .stroke(Color.botanicalBorderSubtle, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: BotanicalTheme.controlCornerRadius + 6, style: .continuous))
    }
}
