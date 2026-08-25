import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/CookieConsent";

// One-time safety reset after the August patient-portal identity incident.
// A genuine sign-in updates last_sign_in_at, so users are only asked once.
const GLOBAL_SESSION_RESET_AT = Date.parse("2026-08-25T11:18:00Z");

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const fallbackHref = getClinicFallbackHref();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href={fallbackHref}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {fallbackHref === "/" ? "Go home" : "Back to clinic"}
          </a>
        </div>
      </div>
    </div>
  );
}

function getClinicFallbackHref() {
  if (typeof window === "undefined") return "/";
  const returnTo = new URLSearchParams(window.location.search).get("returnTo");
  if (returnTo?.startsWith("/m/")) return returnTo;
  const slug = window.location.pathname.match(/^\/m\/([^/?#]+)/)?.[1];
  return slug ? `/m/${slug}` : "/";
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MODO — Aesthetics Booking & Clinical Platform" },
      { name: "description", content: "MODO is the UK booking, consultation and clinical records platform built only for aesthetics practitioners." },
      { name: "author", content: "MODO Book" },
      { property: "og:site_name", content: "MODO" },
      { property: "og:title", content: "MODO — Aesthetics Booking & Clinical Platform" },
      { property: "og:description", content: "The UK booking, consultation and clinical records platform built only for aesthetics practitioners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@modobook" },
      { name: "theme-color", content: "#2b2118" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "MODO" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=DM+Serif+Display&family=Fraunces:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&family=Montserrat:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Lora:wght@400;500;600;700&family=Figtree:wght@400;500;600;700&family=Syne:wght@400;500;600;700;800&family=Bricolage+Grotesque:wght@400;500;600;700&family=Crimson+Pro:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://modobook.uk/#organization",
              name: "MODO",
              url: "https://modobook.uk",
              logo: "https://modobook.uk/icon-512.png",
              description:
                "MODO is the UK booking, consultation and clinical records platform built only for aesthetics practitioners.",
              areaServed: "GB",
              sameAs: ["https://www.instagram.com/modobook"],
            },
            {
              "@type": "WebSite",
              "@id": "https://modobook.uk/#website",
              url: "https://modobook.uk",
              name: "MODO",
              publisher: { "@id": "https://modobook.uk/#organization" },
              inLanguage: "en-GB",
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!active || !session) return;

      const lastSignInAt = Date.parse(session.user.last_sign_in_at ?? "");
      if (Number.isFinite(lastSignInAt) && lastSignInAt > GLOBAL_SESSION_RESET_AT) return;

      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut({ scope: "local" });
    });

    return () => {
      active = false;
    };
  }, [queryClient]);

  // Wildcard subdomain routing:
  //   {slug}.modobook.co.uk → /m/{slug}
  //   {slug}.modobook.app   → /m/{slug}
  // Attach the apex + wildcard for each zone in Project Settings → Domains.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname.toLowerCase();
    const path = window.location.pathname;

    const ZONES = [".modobook.co.uk", ".modobook.uk", ".modobook.app"];
    const zone = ZONES.find((z) => host.endsWith(z));
    if (!zone) return;
    const sub = host.slice(0, -zone.length);

    const RESERVED = new Set(["www", "app", "api", "notify", "mail", "admin", "dashboard"]);
    if (!sub || sub.includes(".") || RESERVED.has(sub)) return;

    if (path.startsWith("/m/") || path.startsWith("/auth")) return;

    const suffix = path === "/" ? "" : path;
    const search = window.location.search;
    const hash = window.location.hash;
    window.location.replace(`/m/${sub}${suffix}${search}${hash}`);
  }, []);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        const clinic = window.location.pathname.match(/^\/m\/([^/?#]+)/)?.[1];
        window.location.href = clinic ? `/m/${clinic}/auth` : "/auth";
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        queryClient.invalidateQueries();
      }
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
      <CookieConsent />
    </QueryClientProvider>
  );
}
