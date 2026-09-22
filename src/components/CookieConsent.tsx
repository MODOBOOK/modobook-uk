import { useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";

const KEY = "modo.cookie.consent.v1";

// Show the banner only on MODO's own marketing pages — never on clinic
// booking pages, demo links or other pages sent to patients.
const MARKETING_PREFIXES = [
  "/features",
  "/pricing",
  "/faq",
  "/prescriber-hub",
  "/rewards",
  "/waitlist",
  "/hair-beauty-waitlist",
  "/tla-competition",
  "/privacy",
  "/terms",
];

function isMarketingPath(pathname: string) {
  if (pathname === "/") return true;
  return MARKETING_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!localStorage.getItem(KEY)) setVisible(true);
    } catch {
      // localStorage blocked (private mode) — show once per session
      setVisible(true);
    }
  }, []);

  function accept() {
    try { localStorage.setItem(KEY, "accepted:" + new Date().toISOString()); } catch { /* noop */ }
    setVisible(false);
  }

  if (!visible || !isMarketingPath(location.pathname)) return null;


  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-3 z-[9999] mx-auto max-w-2xl rounded-2xl border border-border/60 bg-white/95 p-4 text-sm shadow-2xl backdrop-blur sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex-1 text-foreground/90">
          MODO uses <strong>strictly necessary</strong> cookies to keep you signed in
          and remember your layout preferences. We don't use advertising or
          cross-site tracking cookies. See our{" "}
          <Link to="/privacy" className="underline">Privacy Policy</Link> and <Link to="/privacy/cookies" className="underline">Cookie Policy</Link>.
        </div>
        <button
          onClick={accept}
          className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
