import SwiftUI

struct BotanicalCard<Content: View>: View {
    let elevated: Bool
    @ViewBuilder var content: Content

    init(elevated: Bool = false, @ViewBuilder content: () -> Content) {
        self.elevated = elevated
        self.content = content()
    }

    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .botanicalCard(cornerRadius: BotanicalTheme.cardCornerRadius, elevated: elevated)
    }
}
