import SwiftUI
import WebKit

// Replace the whole contents of ContentView.swift with this file.
struct ContentView: View {
    private let startURL = URL(string: "https://modobook.uk/auth?next=/app")!
    private let headerColor = Color(red: 250.0 / 255.0, green: 248.0 / 255.0, blue: 245.0 / 255.0)

    var body: some View {
        ZStack {
            headerColor.ignoresSafeArea()
            WebView(url: startURL)
                .ignoresSafeArea(.container, edges: .bottom)
        }
    }
}

struct WebView: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = WKWebsiteDataStore.default()

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // Nothing to update; the page manages its own navigation.
    }

    final class Coordinator: NSObject, WKUIDelegate {
        // Opens Google / Apple sign-in pop-ups in the same web view
        // instead of silently doing nothing.
        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if navigationAction.targetFrame == nil {
                webView.load(navigationAction.request)
            }
            return nil
        }
    }
}

#Preview {
    ContentView()
}
