# Modo Practitioner — iOS App

This project ships as a Capacitor-wrapped iOS app for the practitioner side of `modobook.uk`. The web app is loaded live from the published site, so **every Lovable deploy updates the app instantly** — you only need to resubmit to Apple when native code, permissions, or icons change.

## One-time setup (Mac required)

You'll need:
- macOS with **Xcode 15+**
- **Apple Developer Program** membership ($99/yr) — [enroll here](https://developer.apple.com/programs/enroll/)
- **CocoaPods** (`sudo gem install cocoapods` or `brew install cocoapods`)
- **Bun** (matches this project) or Node 20+

Clone the repo on your Mac, then:

```bash
bun install
bunx cap add ios     # generates the ios/ Xcode project
bunx cap sync ios
```

### Patch the generated iOS project

After `cap add ios` runs, apply these one-time edits inside `ios/App/App/`:

1. **`Info.plist`** — merge in the keys from `ios-template/Info.plist.additions` (camera / photos / Face ID usage strings, `remote-notification` background mode, ATS).
2. **`PrivacyInfo.xcprivacy`** — copy `ios-template/PrivacyInfo.xcprivacy` in as-is.
3. **App icons** — replace `Assets.xcassets/AppIcon.appiconset/` using the 1024×1024 icon in `src/assets/modo-logo.png` (Xcode can slice it via the App Icon set).
4. **Signing** — open `ios/App/App.xcworkspace`, select the App target → *Signing & Capabilities*, set your Team, then add capabilities: **Push Notifications**, **Background Modes → Remote notifications**, **Sign in with Apple** (optional).

## Push notifications (APNs)

1. In the [Apple Developer portal](https://developer.apple.com/account/resources/authkeys/list), create an APNs **auth key** (.p8). Save the file — it's shown once.
2. In Lovable Cloud, add these secrets (Backend → Secrets):
   - `APNS_TEAM_ID` — 10-char team ID
   - `APNS_KEY_ID` — 10-char key ID
   - `APNS_PRIVATE_KEY` — full contents of the .p8 file (including `-----BEGIN…-----`)
   - `APNS_BUNDLE_ID` — `uk.modobook.practitioner`
   - `APNS_ENVIRONMENT` — `production` (or `development` for TestFlight sandbox)

`src/lib/apns.server.ts` signs a fresh JWT and posts to Apple's HTTP/2 endpoint. Tokens returned as invalid (410/400) are auto-removed from `device_push_tokens`.

## Building & shipping

```bash
bunx cap sync ios       # after any dependency change
bunx cap open ios       # opens Xcode
```

In Xcode:
1. Choose *Any iOS Device (arm64)* as the destination.
2. **Product → Archive**.
3. In the Organizer that opens, **Distribute App → App Store Connect → Upload**.
4. In [App Store Connect](https://appstoreconnect.apple.com), create the app (bundle id `uk.modobook.practitioner`), assign the build, fill screenshots + metadata, and submit.

### App Store Connect metadata answers

| Field | Answer |
| --- | --- |
| Primary category | Medical |
| Secondary category | Business |
| Content rights | Does not use third-party content |
| Age rating | 17+ (medical/treatment information) |
| Data collection | Name, email, health, photos — all linked to user, none for tracking |
| Sign-in required | Yes — demo credentials required for review (create a review-only account) |
| Export compliance | Uses only standard HTTPS; `ITSAppUsesNonExemptEncryption` = false |

### Review notes (paste into the submission)

> Modo Practitioner is a clinical management tool for licensed aesthetic
> practitioners in the UK. The app is not for patients. Sign in with the
> reviewer account below to see the practitioner dashboard, appointment
> calendar, and consent workflow. Patient booking pages are available only
> on the public website (modobook.uk) and are intentionally not part of
> this app. All data is processed under UK GDPR; a full privacy policy is
> available at https://modobook.uk/privacy and in-app account deletion is
> available under Settings → Privacy.
>
> Reviewer account:
>   Email: <create one before submitting>
>   Password: <…>

## GDPR features baked in

- **First-run consent modal** — data-processing + health-data acknowledgement, stored locally and mirrored via terms acceptance.
- **In-app data export** — Settings → Privacy → Download JSON.
- **In-app account deletion** — Settings → Privacy → Request deletion (30-day grace period, satisfies App Store guideline 5.1.1(v)).
- **No third-party analytics or tracking SDKs.**
- **APNs tokens are per-user, revocable, and cascade-delete on account deletion** (see `device_push_tokens` RLS).

## Face ID gate

Users can enable Face ID under Settings. When enabled:
- Prompted on cold start.
- Prompted again if the app was in the background for more than 5 minutes.
- Falls back to device passcode; skipped silently if biometry is unavailable.

## Updating the app

- **Web-only changes** (UI, routes, business logic on modobook.uk): no resubmission — the app picks them up on next launch.
- **Native changes** (plugins, permissions, icons, Info.plist): bump `CFBundleVersion` in Xcode, archive, and upload a new build.

## Support / TestFlight

Add internal testers under App Store Connect → *TestFlight → Internal Testing*. They install the TestFlight app, sign in with their Apple ID, and receive builds automatically.
