import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { getPractitionerBio } from "@/lib/practitioner-public.functions";
import { Button } from "@/components/ui/button";
import { UserCircle2 } from "lucide-react";
import { resolveDisplayNames } from "@/lib/display-name";

import { Loader2 } from "lucide-react";


export const Route = createFileRoute("/m/$slug")({
  loader: async ({ params }) => {
    const { profile, theme } = await getPractitionerBio({ data: { slug: params.slug } });
    return { profile, theme };
  },
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
    links: loaderData?.theme?.favicon_url
      ? [{ rel: "icon", href: loaderData.theme.favicon_url }]
      : undefined,
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

  return (
    <div
      className="min-h-screen"
      style={
        {
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
              <TabLink slug={slug} to="/m/$slug/reviews" label="Reviews" />
              <Link to="/m/$slug/account" params={{ slug }} aria-label="My account">
                <Button size="sm" variant="outline" className="ml-1 hidden sm:inline-flex">My account</Button>
                <Button size="icon" variant="outline" className="ml-1 h-8 w-8 sm:hidden">
                  <UserCircle2 className="h-4 w-4" />
                </Button>
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
  to: "/m/$slug" | "/m/$slug/reviews" | "/m/$slug/about";
  label: string;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      params={{ slug }}
      activeOptions={{ exact: !!exact }}
      className="rounded-md px-2 py-1.5 text-xs opacity-70 hover:opacity-100 sm:px-3 sm:text-sm [&.active]:bg-black/5 [&.active]:opacity-100"
    >
      {label}

    </Link>
  );
}
