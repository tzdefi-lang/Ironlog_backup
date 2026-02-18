import SwiftUI

struct NumberStepperField: View {
    @Binding var value: Double
    var step: Double = 1

    var body: some View {
        HStack(spacing: 8) {
            Button("-") { value = max(0, value - step) }
            TextField("", value: $value, format: .number.precision(.fractionLength(0...1)))
                .multilineTextAlignment(.center)
                .textFieldStyle(.roundedBorder)
            Button("+") { value += step }
        }
    }
}
