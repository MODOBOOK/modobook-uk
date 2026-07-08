import SwiftUI
import WebKit

struct ContentView: View {
    @State private var isOffline = false
    @State private var reloadID = UUID()

    // Warm sand header colour from https://modobook.uk — matches the web
    // app's top bar so the status bar area doesn't appear as a white strip.
    private let headerColor = Color(
        red: 250.0 / 255.0,
        green: 248.0 / 255.0,
        blue: 245.0 / 255.0
    )

    var body: some View {
        ZStack {
            // Fill the safe area behind the notch/status bar with the site header colour.
            headerColor
                .ignoresSafeArea()

            WebView(
                url: URL(string: "https://modobook.uk/app")!,
                isOffline: $isOffline,
                reloadID: reloadID
            )
            // Extend the web view to the bottom of the phone, but keep it
            // below the top notch/status bar so it doesn't overlap system UI.
            .ignoresSafeArea(.container, edges: .bottom)

            if isOffline {
                OfflineView {
                    reloadID = UUID()
                }
            }
        }
    }
}

struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var isOffline: Bool
    let reloadID: UUID

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.lastReloadID != reloadID else { return }
        context.coordinator.lastReloadID = reloadID
        let request = URLRequest(url: url)
        webView.load(request)
    }

    class Coordinator: NSObject, WKNavigationDelegate {
        var parent: WebView
        var lastReloadID: UUID?

        init(_ parent: WebView) {
            self.parent = parent
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            parent.isOffline = true
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            parent.isOffline = true
        }

        func webView(
            _ webView: WKWebView,
            didFinish navigation: WKNavigation!
        ) {
            parent.isOffline = false
        }
    }
}

struct OfflineView: View {
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Text("You're offline")
                .font(.headline)
            Text("Check your connection and try again.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Retry", action: onRetry)
                .buttonStyle(.borderedProminent)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.ultraThinMaterial)
        .ignoresSafeArea()
    }
}

#Preview {
    ContentView()
}
