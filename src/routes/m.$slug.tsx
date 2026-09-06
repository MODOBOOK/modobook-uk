import { createFileRoute, Link, Outlet, notFound, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPractitionerBio } from "@/lib/practitioner-public.functions";
import { getPublicRewardsOverview } from "@/lib/rewards.functions";
import { listPublicGiftCards } from "@/lib/gift-cards.functions";
import { listPublicMembershipPlans } from "@/lib/memberships.functions";
import { Button } from "@/components/ui/button";
import { UserCircle2 } from "lucide-react";
import { resolveDisplayNames } from "@/lib/display-name";
import { buildThemeVars } from "@/lib/theme-vars";
import { useEffect, useMemo } from "react";

import { Loader2 } from "lucide-react";


export const Route = createFileRoute("/m/$slug")({
  loader: async ({ params }) => {
    // In-app browsers (Instagram, Facebook) drop the occasional request, which
    // used to bubble up as the full-page "This page didn't load" screen and
    // locked patients out of signing in. Retry transient failures first.
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const { profile, theme } = await getPractitionerBio({ data: { slug: params.slug } });
        return { profile, theme, slug: params.slug };
      } catch (err) {
        lastError = err;
        const message = (err as Error)?.message ?? "";
        if (message.toLowerCase().includes("not found")) throw notFound();
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    throw lastError;
  },
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">We couldn't load this page</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Your connection dropped for a moment. Tap retry — if you're in the Instagram browser,
        opening the link in Safari or Chrome is more reliable.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={() => reset()}>Retry</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>Reload page</Button>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">This MODO link does not exist.</p>
      <Link to="/" className="mt-6"><Button>Go home</Button></Link>
    </div>
  ),

  head: ({ loaderData }) => ({
    meta: (() => {
      const headerName = loaderData?.profile ? resolveDisplayNames(loaderData.profile).primary : "Clinic";
      const title = `${headerName} · MODO`;
      const description = loaderData?.profile.tagline ?? "Book treatments on MODO.";
      const image = loaderData?.theme?.hero_image_url ?? loaderData?.profile.hero_url;

      return [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ];
    })(),
    links: (() => {
      // Browser tab favicon: only override MODO's default when the practitioner
      // explicitly uploaded a favicon. Do NOT fall back to their logo/avatar.
      const favicon = loaderData?.theme?.favicon_url;
      // Home-screen icon (Add to Home Screen on iOS/Android): prefer the
      // practitioner's logo so their brand shows on the patient's device.
      const homeIcon =
        loaderData?.theme?.logo_url ||
        loaderData?.theme?.favicon_url ||
        loaderData?.profile.avatar_url ||
        null;

      const headerName = loaderData?.profile
        ? resolveDisplayNames(loaderData.profile).primary
        : "Clinic";
      const themeColor = loaderData?.theme?.primary_color || "#2b2118";
      const bgColor = loaderData?.theme?.background_color || "#f5efe6";

      const links: Array<Record<string, string>> = [];

      if (favicon) {
        links.push(
          { rel: "icon", href: favicon },
          { rel: "icon", type: "image/png", href: favicon },
          { rel: "icon", type: "image/png", sizes: "192x192", href: favicon },
          { rel: "icon", type: "image/png", sizes: "512x512", href: favicon },
          { rel: "shortcut icon", href: favicon },
        );
      }

      if (homeIcon) {
        links.push(
          { rel: "apple-touch-icon", href: homeIcon },
          { rel: "apple-touch-icon", sizes: "180x180", href: homeIcon },
        );

        // Per-practitioner web app manifest so Android/desktop PWA installs
        // use the practitioner's logo and name on the home screen.
        const manifest = {
          name: headerName,
          short_name: headerName.slice(0, 12) || "Clinic",
          start_url: `/m/${loaderData?.slug ?? ""}`,
          scope: `/m/${loaderData?.slug ?? ""}`,
          display: "standalone",
          background_color: bgColor,
          theme_color: themeColor,
          icons: [
            { src: homeIcon, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: homeIcon, sizes: "512x512", type: "image/png", purpose: "any" },
            { src: homeIcon, sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        };
        const manifestHref =
          "data:application/manifest+json;charset=utf-8," +
          encodeURIComponent(JSON.stringify(manifest));
        links.push({ rel: "manifest", href: manifestHref });
      }

      return links.length ? links : undefined;
    })(),
    scripts: (() => {
      if (!loaderData?.profile) return undefined;
      const name = resolveDisplayNames(loaderData.profile).primary;
      const image = loaderData.theme?.hero_image_url ?? loaderData.profile.hero_url ?? undefined;
      return [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HealthAndBeautyBusiness",
            name,
            url: `https://modobook.uk/m/${loaderData.slug}`,
            description: loaderData.profile.tagline ?? undefined,
            image: image ?? undefined,
            logo: loaderData.theme?.logo_url ?? loaderData.profile.avatar_url ?? undefined,
            areaServed: "GB",
          }),
        },
      ];
    })(),
  }),
  component: ModoLayout,
});

function ModoLayout() {
  const { profile, theme } = Route.useLoaderData();
  const { primary: displayPrimary, secondary: displaySecondary } = resolveDisplayNames(profile);
  const { slug } = useParams({ from: "/m/$slug" });
  const brand = theme?.primary_color || profile.brand_color || "#111827";

  const accent = theme?.accent_color || brand;
  const headerBg = theme?.header_bg_color || "#ffffff";
  const headerText = theme?.header_text_color || "#0f172a";
  void theme?.footer_bg_color;
  void theme?.footer_text_color;

  const bgColor = theme?.background_color || "transparent";
  const textColor = theme?.text_color || "inherit";
  const headingFont = theme?.heading_font || "inherit";
  const bodyFont = theme?.body_font || "inherit";

  // Map the practitioner's palette onto the shadcn semantic tokens so every
  // card, button, input and dialog in the patient portal is branded.
  const themeVars = useMemo(
    () => buildThemeVars(theme as Record<string, unknown> | null | undefined),
    [theme],
  );
  const serializedVars = JSON.stringify(themeVars);
  useEffect(() => {
    const root = document.documentElement;
    const applied: string[] = [];
    for (const [key, val] of Object.entries(themeVars)) {
      root.style.setProperty(key, val);
      applied.push(key);
    }
    return () => {
      for (const key of applied) root.style.removeProperty(key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedVars]);

  return (
    <div
      className="min-h-screen"
      style={
        {
          ...themeVars,
          backgroundColor: bgColor,
          color: textColor,
          fontFamily: bodyFont,
          ["--brand" as string]: brand,
          ["--brand-accent" as string]: accent,
          ["--heading-font" as string]: headingFont,
        } as React.CSSProperties
      }
    >
      <style>{(() => {
        // Defence in depth: strip any attempt to break out of the <style> element
        // and clamp font names to a safe character set.
        const safeFont = String(headingFont ?? "")
          .replace(/[^a-zA-Z0-9\s\-_,'"]/g, "")
          .slice(0, 80) || "inherit";
        const rawCss = String(theme?.custom_css ?? "");
        const safeCss = rawCss
          .replace(/<\/?\s*style\b[^>]*>/gi, "")
          .replace(/<\/?\s*script\b[^>]*>/gi, "")
          .replace(/<!--[\s\S]*?-->/g, "")
          .slice(0, 20000);
        return `
          .modo-shell h1, .modo-shell h2, .modo-shell h3 { font-family: ${safeFont}; }
          ${safeCss}
        `;
      })()}</style>

      <div className="modo-shell">
        <header
          className={`${theme?.header_sticky === false ? "" : "sticky top-0"} z-30 border-b`}
          style={{ backgroundColor: headerBg, color: headerText }}
        >
          <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-4">
            <Link to="/m/$slug" params={{ slug }} className="flex min-w-0 items-center gap-2 sm:gap-3">
              {(() => {
                const sizeKey = theme?.header_logo_size ?? "medium";
                const logoCls =
                  sizeKey === "small" ? "h-10 sm:h-12" :
                  sizeKey === "large" ? "h-20 sm:h-24" :
                  "h-14 sm:h-16";
                const avatarCls =
                  sizeKey === "small" ? "h-9 w-9 sm:h-10 sm:w-10" :
                  sizeKey === "large" ? "h-14 w-14 sm:h-16 sm:w-16" :
                  "h-11 w-11 sm:h-12 sm:w-12";
                return theme?.logo_url ? (
                  <img src={theme.logo_url} alt={displayPrimary} className={`${logoCls} w-auto shrink-0 object-contain`} />
                ) : (
                  <>
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className={`${avatarCls} shrink-0 rounded-full object-cover`} />
                    ) : (
                      <div
                        className={`${avatarCls} flex shrink-0 items-center justify-center rounded-full text-white`}
                        style={{ backgroundColor: brand }}
                      >
                        <span className="text-base font-bold sm:text-lg">{displayPrimary.charAt(0) || "M"}</span>
                      </div>
                    )}
                    {(theme?.header_show_name ?? true) && (
                      <div className="min-w-0">
                        <div
                          className="font-semibold leading-tight break-words [overflow-wrap:anywhere] line-clamp-2"
                          style={{ fontSize: "clamp(0.75rem, 3.2vw, 0.95rem)" }}
                        >
                          {displayPrimary}
                        </div>
                        {(theme?.header_show_tagline ?? true) && displaySecondary && (
                          <div className="truncate text-[11px] opacity-70 sm:text-xs">{displaySecondary}</div>
                        )}
                      </div>
                    )}
                  </>
                );

              })()}
            </Link>
            <nav className="flex shrink-0 items-center gap-0.5 text-sm sm:gap-1">
              <TabLink slug={slug} to="/m/$slug" label={theme?.header_button_label || "Book"} exact />
              <TabLink slug={slug} to="/m/$slug/about" label="About" />
              <RewardsTabLink slug={slug} />
              <MembershipsTabLink slug={slug} />
              <TabLink slug={slug} to="/m/$slug/reviews" label="Reviews" />
              <Link to="/m/$slug/account" params={{ slug }} aria-label="My account">
                {/* Styled from the header's own text colour (currentColor) so the
                    account control stays visible on any practitioner palette. */}
                <span
                  className="ml-1 hidden h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] sm:inline-flex"
                  style={{
                    color: headerText,
                    borderColor: "color-mix(in srgb, currentColor 35%, transparent)",
                    backgroundColor: "transparent",
                  }}
                >
                  <UserCircle2 className="h-4 w-4" />
                  My account
                </span>
                <span
                  className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)] sm:hidden"
                  style={{
                    color: headerText,
                    borderColor: "color-mix(in srgb, currentColor 35%, transparent)",
                    backgroundColor: "transparent",
                  }}
                >
                  <UserCircle2 className="h-4 w-4" />
                </span>
              </Link>

            </nav>
          </div>
        </header>

        <Outlet />

      </div>
    </div>
  );
}

function TabLink({
  slug,
  to,
  label,
  exact,
}: {
  slug: string;
  to: "/m/$slug" | "/m/$slug/rewards" | "/m/$slug/reviews" | "/m/$slug/about" | "/m/$slug/training" | "/m/$slug/gift-cards" | "/m/$slug/memberships";
  label: string;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      params={{ slug }}
      activeOptions={{ exact: !!exact }}
      className="rounded-md px-2 py-1.5 text-xs opacity-70 hover:opacity-100 sm:px-3 sm:text-sm [&.active]:bg-[color-mix(in_srgb,currentColor_12%,transparent)] [&.active]:opacity-100"
    >
      {label}

    </Link>
  );
}

function RewardsTabLink({ slug }: { slug: string }) {
  const fetchPublic = useServerFn(getPublicRewardsOverview);
  const q = useQuery({
    queryKey: ["public-rewards-visible", slug],
    queryFn: () => fetchPublic({ data: { slug } }),
    staleTime: 60_000,
  });
  if (!q.data || q.data.visible !== true) return null;
  return <TabLink slug={slug} to="/m/$slug/rewards" label="Rewards" />;
}

function GiftCardsTabLink({ slug }: { slug: string }) {
  const fetchCards = useServerFn(listPublicGiftCards);
  const q = useQuery({
    queryKey: ["public-gift-cards-visible", slug],
    queryFn: () => fetchCards({ data: { slug } }),
    staleTime: 60_000,
  });
  const cards = (q.data?.cards ?? []) as Array<unknown>;
  if (cards.length === 0) return null;
  return <TabLink slug={slug} to="/m/$slug/gift-cards" label="Gift cards" />;
}

function MembershipsTabLink({ slug }: { slug: string }) {
  const fetchPlans = useServerFn(listPublicMembershipPlans);
  const q = useQuery({
    queryKey: ["public-memberships-visible", slug],
    queryFn: () => fetchPlans({ data: { slug } }),
    staleTime: 60_000,
  });
  if (!q.data || (q.data.plans as unknown[]).length === 0) return null;
  return <TabLink slug={slug} to="/m/$slug/memberships" label="Memberships" />;
}
