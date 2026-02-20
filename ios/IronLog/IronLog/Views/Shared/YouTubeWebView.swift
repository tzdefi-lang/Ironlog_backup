import SwiftUI
import WebKit

struct YouTubeWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.scrollView.isScrollEnabled = false
        webView.backgroundColor = .clear
        webView.isOpaque = false
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // Only reload if the webview is idle (not loading) and hasn't loaded this URL.
        // During loading, uiView.url is nil which would cause an infinite reload loop.
        guard !uiView.isLoading, uiView.url != url else { return }
        uiView.load(URLRequest(url: url))
    }
}
