import SwiftUI

struct ConfirmDialog: ViewModifier {
    @Binding var isPresented: Bool
    let title: String
    let message: String
    let confirmTitle: String
    let isDanger: Bool
    let onConfirm: () -> Void

    func body(content: Content) -> some View {
        content
            .confirmationDialog(title, isPresented: $isPresented) {
                Button(confirmTitle, role: isDanger ? .destructive : .none, action: onConfirm)
                Button("Cancel", role: .cancel) {}
            } message: {
                Text(message)
            }
    }
}

extension View {
    func confirmDialog(
        isPresented: Binding<Bool>,
        title: String,
        message: String,
        confirmTitle: String,
        isDanger: Bool = false,
        onConfirm: @escaping () -> Void
    ) -> some View {
        modifier(
            ConfirmDialog(
                isPresented: isPresented,
                title: title,
                message: message,
                confirmTitle: confirmTitle,
                isDanger: isDanger,
                onConfirm: onConfirm
            )
        )
    }
}
