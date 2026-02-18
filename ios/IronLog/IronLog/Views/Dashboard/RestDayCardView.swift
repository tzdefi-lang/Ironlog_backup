import SwiftUI

struct RestDayCardView: View {
    var onStart: () -> Void

    var body: some View {
        BotanicalCard(elevated: true) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Recovery Day")
                    .font(.display(28))
                Text("No active workout for today. Start a new one or pick a template.")
                    .font(.botanicalBody(15))
                    .foregroundStyle(Color.botanicalTextSecondary)
                BotanicalButton(title: "Start Workout", variant: .primary, action: onStart)
            }
        }
    }
}
