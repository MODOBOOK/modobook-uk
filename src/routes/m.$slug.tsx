import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { getPractitionerBio } from "@/lib/practitioner-public.functions";
import { Button } from "@/components/ui/button";
import { UserCircle2 } from "lucide-react";

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
      <p className="mt-2 text-muted-foreground">This MODO Book link does not exist.</p>
      <Link to="/" className="mt-6"><Button>Go home</Button></Link>
    </div>
  ),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.profile.clinic_name ?? "Clinic"} · MODO Book` },
      { name: "description", content: loaderData?.profile.tagline ?? "Book treatments on MODO Book." },
    ],
    links: loaderData?.theme?.favicon_url
      ? [{ rel: "icon", href: loaderData.theme.favicon_url }]
      : undefined,
  }),
  component: ModoLayout,
});

function ModoLayout() {
  const { profile, theme } = Route.useLoaderData();
  const { slug } = useParams({ from: "/m/$slug" });
  const brand = theme?.primary_color || profile.brand_color || "#111827";
  const accent = theme?.accent_color || brand;
  const headerBg = theme?.header_bg_color || "#ffffff";
  const headerText = theme?.header_text_color || "#0f172a";
  const footerBg = theme?.footer_bg_color || "#0f172a";
  const footerText = theme?.footer_text_color || "#ffffff";
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
      <style>{`
        .modo-shell h1, .modo-shell h2, .modo-shell h3 { font-family: ${headingFont}; }
        ${theme?.custom_css ?? ""}
      `}</style>
      <div className="modo-shell">
        <header className="border-b" style={{ backgroundColor: headerBg, color: headerText }}>
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
            <Link to="/m/$slug" params={{ slug }} className="flex items-center gap-3">
              {theme?.logo_url ? (
                <img src={theme.logo_url} alt="" className="h-10 w-auto object-contain" />
              ) : profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: brand }}
                >
                  <span className="text-lg font-bold">{profile.clinic_name?.charAt(0) || "M"}</span>
                </div>
              )}
              <div>
                <div className="text-sm font-semibold leading-tight">{profile.clinic_name}</div>
                <div className="text-xs opacity-70">{profile.full_name}</div>
              </div>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <TabLink slug={slug} to="/m/$slug" label="Book" exact />
              <TabLink slug={slug} to="/m/$slug/about" label="About" />
              <TabLink slug={slug} to="/m/$slug/reviews" label="Reviews" />
              <Link to="/m/$slug/account" params={{ slug }}>
                <Button size="sm" variant="outline">My account</Button>
              </Link>
            </nav>
          </div>
        </header>
        <Outlet />
        <footer className="mt-16 border-t" style={{ backgroundColor: footerBg, color: footerText }}>
          <div className="mx-auto max-w-5xl px-4 py-6 text-center text-xs opacity-80">
            Powered by <span className="font-semibold tracking-wide">MODO Book</span>
          </div>
        </footer>
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
  to: "/m/$slug" | "/m/$slug/about" | "/m/$slug/reviews";
  label: string;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      params={{ slug }}
      activeOptions={{ exact: !!exact }}
      className="rounded-md px-3 py-1.5 opacity-70 hover:opacity-100 [&.active]:bg-black/5 [&.active]:opacity-100"
    >
      {label}
    </Link>
  );
}
