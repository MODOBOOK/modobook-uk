import {
  getVapidPublicKey,
  savePushSubscription,
  deletePushSubscription,
} from "@/lib/push.functions";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export async function getPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/push-sw.js");
    if (existing) return existing;
    return await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export async function getPushState(): Promise<"unsupported" | "denied" | "granted" | "prompt"> {
  if (!pushSupported()) return "unsupported";
  const perm = Notification.permission;
  if (perm === "denied") return "denied";
  if (perm === "granted") {
    const reg = await getPushRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub ? "granted" : "prompt";
  }
  return "prompt";
}

export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "This device or browser doesn't support push notifications." };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "Permission denied. Enable notifications in your browser settings." };

  const reg = await getPushRegistration();
  if (!reg) return { ok: false, reason: "Couldn't register the service worker." };

  const { publicKey } = await getVapidPublicKey();
  if (!publicKey) return { ok: false, reason: "Push isn't configured on the server." };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
    });
  }
  const p256dh = bufToB64Url(sub.getKey("p256dh"));
  const auth = bufToB64Url(sub.getKey("auth"));
  await savePushSubscription({
    data: {
      endpoint: sub.endpoint,
      p256dh,
      auth,
      userAgent: navigator.userAgent,
    },
  });
  return { ok: true };
}

export async function disablePush(): Promise<void> {
  const reg = await getPushRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    try {
      await deletePushSubscription({ data: { endpoint: sub.endpoint } });
    } catch {}
    try {
      await sub.unsubscribe();
    } catch {}
  }
}
