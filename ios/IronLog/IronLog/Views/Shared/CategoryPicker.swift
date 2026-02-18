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
    }
}
