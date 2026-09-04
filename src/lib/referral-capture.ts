/**
 * Remembers a practitioner referral code (?ref=XXX) from any marketing page so
 * it can be pre-filled — and auto-applied — on Plan & billing after signup.
 */
const KEY = "modo_partner_ref";

export function captureReferralFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const ref = (url.searchParams.get("ref") || "").trim().toUpperCase();
    if (ref) {
      localStorage.setItem(KEY, ref);
      return ref;
    }
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function storeReferral(code: string) {
  if (typeof window === "undefined") return;
  try {
    const clean = code.trim().toUpperCase();
    if (clean) localStorage.setItem(KEY, clean);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function getStoredReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearStoredReferral() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
