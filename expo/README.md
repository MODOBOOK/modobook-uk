# Modo Practitioner — Expo App

This is an Expo-native shell that runs **in parallel** with the existing Capacitor iOS app. It loads the live practitioner web app at `https://modobook.uk/app`, so every Lovable deploy updates the app instantly.

## Project structure

- `/` — TanStack Start web app + Capacitor iOS shell (`capacitor.config.ts`, `ios-template/`)
- `/expo` — Expo/React Native shell (`app.json`, `eas.json`, `App.tsx`)

The Expo app is intentionally isolated in its own folder with its own dependencies so it never conflicts with the web build.

## One-time setup

```bash
cd expo
bun install
```

Then link the project to your EAS account:

```bash
npx eas-cli@latest init --id 8d03f216-aba9-4601-a756-33cd265d8cc4
```

## Run locally

```bash
cd expo
bun run ios      # iOS simulator
bun run android  # Android emulator
```

## Build with EAS

```bash
cd expo

# Internal preview build
bun run build:ios --profile preview

# App Store production build
npx eas-cli@latest build --profile production
```

## What the app does today

- `App.tsx` renders a full-screen WebView pointed at `https://modobook.uk/app`.
- The WebView restricts navigation to Modo, Lovable, Supabase, and Stripe domains.
- A native header shows the app title; the rest of the UI is the live web app.

## What can be added next

Because you asked for a **mix of WebView + native UI**, the shell is ready for:

- **Face ID / biometrics gate** before the WebView loads.
- **Push notifications** using Expo’s `expo-notifications` plugin.
- **Native settings screen** alongside the WebView (tab navigator or modal).
- **Deep links** into specific practitioner routes.

Add these as native screens/components in `expo/` without touching the web app.

## Bundle IDs

- Capacitor iOS: `uk.modobook.practitioner`
- Expo iOS/Android: `uk.modobook.practitioner.expo`

Keep them different so the two apps can be installed side-by-side.
