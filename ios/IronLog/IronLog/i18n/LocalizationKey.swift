import Foundation

enum L10n {
    static func string(_ key: String, _ args: CVarArg...) -> String {
        let format = NSLocalizedString(key, comment: "")
        guard !args.isEmpty else { return format }
        return String(format: format, locale: Locale.current, arguments: args)
    }
}
