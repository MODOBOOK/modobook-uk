/**
 * Allowlist for redirect/return origins supplied by the browser (Stripe
 * success/cancel URLs, portal return URLs, magic-link redirects). Anything
 * else falls back to the canonical site so callers can't bounce users to an
 * attacker-controlled domain.
 */
const CANONICAL = "https://modobook.uk";
const PROJECT_ID = "ad2db8dc-b519-4cbc-b7c4-dc1d5eed30c6";

export function isAllowedOrigin(origin: string): boolean {
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return false;
  }
  const h = u.hostname.toLowerCase();
  if (u.protocol === "http:" && (h === "localhost" || h === "127.0.0.1")) return true;
  if (u.protocol !== "https:") return false;
  if (h === "modobook.uk" || h.endsWith(".modobook.uk")) return true;
  if (h === "modobook-uk.lovable.app") return true;
  if (h.endsWith(".lovable.app") && h.includes(PROJECT_ID)) return true;
  if (h.endsWith(".lovableproject.com") && h.includes(PROJECT_ID)) return true;
  return false;
}

/** Returns a safe origin (scheme+host, no trailing slash). */
export function safeOrigin(origin: string | null | undefined): string {
  if (!origin) return CANONICAL;
  try {
    const u = new URL(origin);
    return isAllowedOrigin(u.origin) ? u.origin : CANONICAL;
  } catch {
    return CANONICAL;
  }
}

/** Returns the URL if its origin is allowed, else the fallback path on the canonical site. */
export function safeUrl(url: string | null | undefined, fallbackPath = "/"): string {
  if (url) {
    try {
      const u = new URL(url);
      if (isAllowedOrigin(u.origin)) return u.toString();
    } catch {
      /* fall through */
    }
  }
  return CANONICAL + fallbackPath;
}
