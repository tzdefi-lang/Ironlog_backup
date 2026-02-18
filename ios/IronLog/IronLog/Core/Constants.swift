import Foundation

enum Constants {
    private static let privyAppClientIdRaw = env(
        "PRIVY_APP_CLIENT_ID",
        fallback: "client-WY6W1dnLZM3Uwpjtz9YsqhX5SZJUDiDjhcNcHT1vjbWFh"
    )

    private static let privyAuthProxyRaw = env("PRIVY_AUTH_PROXY_URL", fallback: "http://localhost:3000/#/native-auth")

    static let supabaseURL = URL(string: env("SUPABASE_URL", fallback: "https://gyiqdkmvlixwgedjhycc.supabase.co"))!
    static let supabaseAnonKey = env("SUPABASE_ANON_KEY", fallback: "sb_publishable_psIWS8xZmx4aCqVnzUFkyg_vjM1kPiz")
    static let privyAppId = env("PRIVY_APP_ID", fallback: "cmlib187t04f3jo0cy0ffgof8")
    static let privyAppClientId = privyAppClientIdRaw
    static let privyAppURLScheme = env("PRIVY_APP_URL_SCHEME", fallback: "ironlog")
    static let privyAuthProxyURL = URL(string: privyAuthProxyRaw)!

    static let privyAuthProxyURLCandidates: [URL] = {
        guard let primary = URL(string: privyAuthProxyRaw) else { return [] }

        var urls: [URL] = [primary]
        guard let host = primary.host?.lowercased(), host == "localhost" || host == "127.0.0.1" else {
            return urls
        }

        let fallbackPorts = [primary.port ?? 3000, 3000, 5173]
        let hosts = ["localhost", "127.0.0.1"]
        for candidateHost in hosts {
            for candidatePort in fallbackPorts {
                guard var components = URLComponents(url: primary, resolvingAgainstBaseURL: false) else {
                    continue
                }
                components.host = candidateHost
                components.port = candidatePort
                guard let candidate = components.url else { continue }
                if !urls.contains(where: { $0.absoluteString == candidate.absoluteString }) {
                    urls.append(candidate)
                }
            }
        }

        return urls
    }()

    static let adminEmails: Set<String> = {
        let raw = env("ADMIN_EMAILS", fallback: "xz1919810@gmail.com,tzdefi@gmail.com")
        return Set(raw.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() })
    }()

    static let bodyPartOptions = [
        "Neck", "Chest", "Shoulders", "Back", "Arms", "Forearms", "Abs", "Glutes", "Quads", "Hamstrings",
        "Calves", "Full Body", "Cardio", "Other"
    ]

    static func env(_ key: String, fallback: String) -> String {
        let process = ProcessInfo.processInfo.environment[key]?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let process, !process.isEmpty {
            return process
        }
        return fallback
    }
}
