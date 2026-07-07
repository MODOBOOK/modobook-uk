/**
 * Runtime helpers for the native (Capacitor iOS) shell.
 *
 * These are safe to call from any client component — on the web they
 * short-circuit to no-ops, so the same UI works in a browser and inside
 * the iOS app.
 */
import { useEffect, useState } from "react";

// Lazy imports so the web bundle doesn't try to resolve native modules at SSR.
async function cap() {
  const { Capacitor } = await import("@capacitor/core");
  return Capacitor;
}

let cachedIsNative: boolean | null = null;

export function isNativeAppSync(): boolean {
  if (cachedIsNative !== null) return cachedIsNative;
  if (typeof window === "undefined") return false;
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  cachedIsNative = !!w.Capacitor?.isNativePlatform?.();
  return cachedIsNative;
}

export function useIsNativeApp(): boolean {
  const [v, setV] = useState<boolean>(false);
  useEffect(() => { setV(isNativeAppSync()); }, []);
  return v;
}

export function useNativePlatform(): "ios" | "android" | "web" {
  const [p, setP] = useState<"ios" | "android" | "web">("web");
  useEffect(() => {
    (async () => {
      const C = await cap();
      setP((C.getPlatform() as "ios" | "android" | "web") ?? "web");
    })();
  }, []);
  return p;
}

/**
 * Prompt the user to pick or take a photo via the native camera plugin.
 * Returns a File suitable for the existing upload flow, or null if cancelled.
 * Falls back to null on web — callers should fall through to <input type=file>.
 */
export async function pickPhotoNative(): Promise<File | null> {
  if (!isNativeAppSync()) return null;
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
      promptLabelHeader: "Add photo",
      promptLabelPhoto: "Choose from library",
      promptLabelPicture: "Take photo",
    });
    if (!photo.dataUrl) return null;
    const res = await fetch(photo.dataUrl);
    const blob = await res.blob();
    const ext = photo.format || "jpg";
    return new File([blob], `photo-${Date.now()}.${ext}`, { type: blob.type || `image/${ext}` });
  } catch {
    return null;
  }
}

/**
 * Attempt biometric authentication. Returns true if the user passed
 * (or biometry is unavailable on this device, so we don't lock them out).
 */
export async function authenticateBiometric(reason = "Unlock Modo Practitioner"): Promise<boolean> {
  if (!isNativeAppSync()) return true;
  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    const info = await BiometricAuth.checkBiometry();
    if (!info.isAvailable) return true;
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: "Cancel",
      allowDeviceCredential: true,
      iosFallbackTitle: "Use passcode",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Register the device for APNs push and return the token.
 * Silently no-ops on web.
 */
export async function registerPushToken(): Promise<string | null> {
  if (!isNativeAppSync()) return null;
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const perm = await PushNotifications.checkPermissions();
  let status = perm.receive;
  if (status !== "granted") {
    const req = await PushNotifications.requestPermissions();
    status = req.receive;
  }
  if (status !== "granted") return null;

  return new Promise<string | null>((resolve) => {
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    PushNotifications.addListener("registration", (token) => finish(token.value));
    PushNotifications.addListener("registrationError", () => finish(null));
    PushNotifications.register().catch(() => finish(null));
    setTimeout(() => finish(null), 15_000);
  });
}

/** Open a URL in the system browser (used for patient-facing links). */
export async function openExternal(url: string): Promise<void> {
  if (!isNativeAppSync()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}
