import SwiftUI

struct CategoryPicker: View {
    @Binding var value: String

    var body: some View {
        Picker("Category", selection: $value) {
            ForEach(Constants.bodyPartOptions, id: \.self) { option in
                Text(option).tag(option)
            }
        }
        .pickerStyle(.menu)
        .accessibilityLabel("Select body part category")
        .onChange(of: value) { _, _ in
            HapticManager.shared.selection()
        }
    }
}
