import SwiftUI
import WebKit

struct PrivyWebAuthView: UIViewRepresentable {
    let onTokenReceived: (String) -> Void
    var onLoadError: ((String) -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator(
            onTokenReceived: onTokenReceived,
            onLoadError: onLoadError,
            candidateURLs: Constants.privyAuthProxyURLCandidates.isEmpty ? [Constants.privyAuthProxyURL] : Constants.privyAuthProxyURLCandidates
        )
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let contentController = WKUserContentController()

        let script = WKUserScript(
            source: """
            window.__privyCallback = function(accessToken) {
              window.webkit.messageHandlers.privyToken.postMessage(accessToken);
            };
            """,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: false
        )

        contentController.addUserScript(script)
        contentController.add(context.coordinator, name: "privyToken")
        configuration.userContentController = contentController
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        context.coordinator.attach(webView: webView)
        context.coordinator.loadInitial()
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
        private let onTokenReceived: (String) -> Void
        private let onLoadError: ((String) -> Void)?
        private let candidateURLs: [URL]
        private weak var webView: WKWebView?
        private var activeURLIndex = 0
        private var hasReportedError = false
        private var hasReceivedToken = false

        init(
            onTokenReceived: @escaping (String) -> Void,
            onLoadError: ((String) -> Void)?,
            candidateURLs: [URL]
        ) {
            self.onTokenReceived = onTokenReceived
            self.onLoadError = onLoadError
            self.candidateURLs = candidateURLs
        }

        func attach(webView: WKWebView) {
            self.webView = webView
        }

        func loadInitial() {
            load(at: 0)
        }

        private func load(at index: Int) {
            guard let webView, index < candidateURLs.count else { return }
            activeURLIndex = index
            hasReportedError = false

            let request = URLRequest(
                url: candidateURLs[index],
                cachePolicy: .reloadIgnoringLocalAndRemoteCacheData,
                timeoutInterval: 12
            )
            webView.load(request)
        }

        private func handleLoadFailure(_ error: Error) {
            guard !hasReceivedToken else { return }

            let nsError = error as NSError
            if shouldRetry(error: nsError), activeURLIndex + 1 < candidateURLs.count {
                load(at: activeURLIndex + 1)
                return
            }

            guard !hasReportedError else { return }
            hasReportedError = true

            let currentURL = candidateURLs[min(activeURLIndex, candidateURLs.count - 1)].absoluteString
            let message = """
            Failed to open auth page (\(nsError.code)).
            URL: \(currentURL)
            Start `npm run dev`, or set PRIVY_AUTH_PROXY_URL to a deployed `/#/native-auth` page.
            """
            DispatchQueue.main.async { [onLoadError] in
                onLoadError?(message)
            }
        }

        private func shouldRetry(error: NSError) -> Bool {
            guard error.domain == NSURLErrorDomain else { return false }

            switch error.code {
            case NSURLErrorCannotFindHost,
                NSURLErrorCannotConnectToHost,
                NSURLErrorTimedOut,
                NSURLErrorNetworkConnectionLost:
                return true
            default:
                return false
            }
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "privyToken", let token = message.body as? String {
                hasReceivedToken = true
                onTokenReceived(token)
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
            handleLoadFailure(error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) {
            handleLoadFailure(error)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            // Privy / OAuth providers may open a new window; reuse current view to avoid dead popup flows.
            if navigationAction.targetFrame == nil, let requestURL = navigationAction.request.url {
                webView.load(URLRequest(url: requestURL))
            }
            return nil
        }
    }
}
