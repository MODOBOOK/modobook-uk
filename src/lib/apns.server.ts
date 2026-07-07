/**
 * APNs (Apple Push Notification service) sender.
 * Server-only: uses HTTP/2 via fetch to api.push.apple.com with a signed JWT.
 *
 * Requires these Cloud secrets:
 *   APNS_TEAM_ID       — 10-char Apple Team ID
 *   APNS_KEY_ID        — 10-char APNs auth key ID
 *   APNS_PRIVATE_KEY   — contents of the .p8 file (including BEGIN/END lines)
 *   APNS_BUNDLE_ID     — e.g. uk.modobook.practitioner
 *   APNS_ENVIRONMENT   — "production" or "development" (defaults to production)
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface ApnsPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
}

let cachedJwt: { token: string; expiresAt: number } | null = null;

async function signApnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.expiresAt - 60 > now) return cachedJwt.token;

  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const pem = process.env.APNS_PRIVATE_KEY;
  if (!teamId || !keyId || !pem) throw new Error("APNs secrets not configured");

  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const claims = { iss: teamId, iat: now };

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${enc(header)}.${enc(claims)}`;

  const pkcs8 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(pkcs8), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput)),
  );
  const b64 = btoa(String.fromCharCode(...sig)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const token = `${signingInput}.${b64}`;
  cachedJwt = { token, expiresAt: now + 45 * 60 }; // Apple caps at 60 min
  return token;
}

/** Send a push to a single device token. Returns true on 200. */
export async function sendApnsPush(token: string, payload: ApnsPayload): Promise<boolean> {
  const bundleId = process.env.APNS_BUNDLE_ID;
  if (!bundleId) throw new Error("APNS_BUNDLE_ID not set");
  const env = process.env.APNS_ENVIRONMENT === "development" ? "development" : "production";
  const host = env === "production" ? "api.push.apple.com" : "api.sandbox.push.apple.com";

  const jwt = await signApnsJwt();
  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: payload.sound ?? "default",
      badge: payload.badge,
    },
    ...(payload.data ?? {}),
  });

  const res = await fetch(`https://${host}/3/device/${token}`, {
    method: "POST",
    headers: {
      "authorization": `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "content-type": "application/json",
    },
    body,
  });

  if (res.status === 410 || res.status === 400) {
    // Token no longer valid — remove it so we don't keep pushing.
    await supabaseAdmin.from("device_push_tokens").delete().eq("token", token);
  }
  return res.ok;
}

/** Fan out a push to every device token registered for a user. */
export async function sendApnsPushToUser(userId: string, payload: ApnsPayload): Promise<number> {
  const { data } = await supabaseAdmin
    .from("device_push_tokens")
    .select("token")
    .eq("user_id", userId)
    .eq("platform", "ios");
  const tokens = (data ?? []).map((r) => r.token as string);
  const results = await Promise.all(tokens.map((t) => sendApnsPush(t, payload).catch(() => false)));
  return results.filter(Boolean).length;
}
