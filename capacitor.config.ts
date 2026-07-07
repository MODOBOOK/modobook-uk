import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the Modo Practitioner iOS app.
 *
 * The app is a thin native shell that loads the practitioner side of
 * modobook.uk. Every web deploy updates the app instantly; you only
 * resubmit to Apple when native code (plugins, permissions, icons)
 * changes.
 *
 * Build/regenerate the iOS project on a Mac:
 *   bun run cap:add-ios     # first time only
 *   bun run cap:sync        # after every dependency change
 *   npx cap open ios        # opens Xcode to archive & upload
 */
const config: CapacitorConfig = {
  appId: "uk.modobook.practitioner",
  appName: "Modo Practitioner",
  webDir: "dist",
  server: {
    // Load the live practitioner entry route directly.
    // Change to a preview URL for TestFlight beta builds if needed.
    url: "https://modobook.uk/app",
    androidScheme: "https",
    iosScheme: "https",
    cleartext: false,
    allowNavigation: [
      "modobook.uk",
      "*.modobook.uk",
      "*.lovable.app",
      "*.supabase.co",
      "*.stripe.com",
      "js.stripe.com",
      "checkout.stripe.com",
    ],
  },
  ios: {
    contentInset: "always",
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: "#F5EFE6",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#F5EFE6",
      showSpinner: false,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Camera: {
      // usage strings live in Info.plist; see ios-template/Info.plist
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#F5EFE6",
      overlaysWebView: false,
    },
  },
};

export default config;
