import { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";

/**
 * Expo entry point for the Modo Practitioner app.
 *
 * This is a thin native shell. The main practitioner experience is loaded
 * from the live web app at https://modobook.uk/app, so every Lovable deploy
 * updates the app instantly. Native screens can be added later alongside
 * the WebView (e.g. Face ID gate, push-token registration, native settings).
 */

const ENTRY_URL = "https://modobook.uk/app";
const ALLOWED_HOSTS = [
  "modobook.uk",
  "*.modobook.uk",
  "*.lovable.app",
  "*.supabase.co",
  "*.stripe.com",
  "js.stripe.com",
  "checkout.stripe.com",
];

function hostMatches(url: string, host: string): boolean {
  try {
    const u = new URL(url);
    if (host.startsWith("*.")) {
      const suffix = host.slice(2);
      return u.hostname === suffix || u.hostname.endsWith("." + suffix);
    }
    return u.hostname === host;
  } catch {
    return false;
  }
}

function isAllowedUrl(url: string): boolean {
  return ALLOWED_HOSTS.some((h) => hostMatches(url, h));
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webviewRef = useRef<WebView>(null);

  const onNavigationStateChange = (navState: WebViewNavigation) => {
    if (!isAllowedUrl(navState.url)) {
      // External link tapped inside the web app — let the system browser handle it.
      webviewRef.current?.stopLoading();
      return false;
    }
    return true;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5EFE6" />
      <View style={styles.header}>
        <Text style={styles.title}>Modo Practitioner</Text>
      </View>
      <View style={styles.webviewWrap}>
        <WebView
          ref={webviewRef}
          source={{ uri: ENTRY_URL }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={(e) =>
            setError(e.nativeEvent.description || "Could not load Modo")
          }
          onHttpError={(e) => {
            if (e.nativeEvent.statusCode >= 400) {
              setError(`Server error ${e.nativeEvent.statusCode}`);
            }
          }}
          onNavigationStateChange={onNavigationStateChange}
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled
          bounces={false}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#3F7F7C" />
            </View>
          )}
          renderError={(_, __) => (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                {error || "Something went wrong loading Modo."}
              </Text>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5EFE6",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F5EFE6",
    borderBottomWidth: 1,
    borderBottomColor: "#C9BFB2",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2F4349",
    letterSpacing: -0.5,
  },
  webviewWrap: {
    flex: 1,
    backgroundColor: "#F5EFE6",
  },
  webview: {
    flex: 1,
    backgroundColor: "#F5EFE6",
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5EFE6",
  },
  errorBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F5EFE6",
  },
  errorText: {
    color: "#2F4349",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
});
