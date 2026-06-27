import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getPublicClinic } from "@/lib/public-clinic.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Instagram,
  MapPin,
  Share2,
  Info,
  Clock,
  ExternalLink,
  Star,
  ChevronRight,
} from "lucide-react";
import { mapsUrl, formatAddress } from "@/lib/maps";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type Treatment = Database["public"]["Tables"]["treatments"]["Row"];
type Package = Database["public"]["Tables"]["packages"]["Row"];
type Location = Database["public"]["Tables"]["locations"]["Row"];
type Category = Database["public"]["Tables"]["treatment_categories"]["Row"];
type Pricing = Database["public"]["Tables"]["treatment_location_pricing"]["Row"];

export const Route = createFileRoute("/m/$slug/")({
  loader: async ({ params }) => getPublicClinic({ data: { slug: params.slug } }),
  component: BookPage,
});

type CatNode = Category & { children: CatNode[]; treatments: Treatment[] };

function buildTree(categories: Category[], treatments: Treatment[]) {
  const map = new Map<string, CatNode>();
  categories.forEach((c) => map.set(c.id, { ...c, children: [], treatments: [] }));
  const roots: CatNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const uncategorised: Treatment[] = [];
  for (const t of treatments) {
    if (t.category_id && map.has(t.category_id)) {
      map.get(t.category_id)!.treatments.push(t);
    } else {
      uncategorised.push(t);
    }
  }
  return { roots, uncategorised };
}

function countTreatments(n: CatNode): number {
  return n.treatments.length + n.children.reduce((s, c) => s + countTreatments(c), 0);
}

type Theme = Database["public"]["Tables"]["clinic_theme"]["Row"];

function BookPage() {
  const { profile, treatments, packages, locations, categories, pricing, theme, reviews } =
    Route.useLoaderData() as {
      profile: {
        id: string;
        clinic_name: string;
        full_name: string | null;
        tagline: string | null;
        hero_url: string | null;
        avatar_url: string | null;
        about: string | null;
        bio: string | null;
        brand_color: string | null;
        address: unknown;
        social_links: { instagram?: string; facebook?: string; tiktok?: string } | null;
      };
      treatments: Treatment[];
      packages: Package[];
      locations: (Location & { image_url?: string | null })[];
      categories: Category[];
      pricing: Pricing[];
      theme: Theme | null;
      reviews: { id: string; rating: number }[];
    };

  const { slug } = useParams({ from: "/m/$slug/" });
  const brand = theme?.primary_color || profile.brand_color || "#1f2a44";
  const accent = theme?.accent_color || brand;
  const bgColor = theme?.background_color || "#ffffff";
  const textColor = theme?.text_color || "#0f172a";
  const headingFont = theme?.heading_font || "Inter";
  const bodyFont = theme?.body_font || "Inter";
  const heroUrl = theme?.hero_image_url || profile.hero_url;

  const [locationId, setLocationId] = useState<string | null>(
    locations.length === 1 ? locations[0].id : null,
  );

  const priceFor = (t: Treatment) => {
    if (locationId) {
      const o = pricing.find((p) => p.treatment_id === t.id && p.location_id === locationId);
      if (o?.price_cents != null) return o.price_cents / 100;
    }
    return Number(t.price ?? 0);
  };
  const durationFor = (t: Treatment) => {
    if (locationId) {
      const o = pricing.find((p) => p.treatment_id === t.id && p.location_id === locationId);
      if (o?.duration_minutes != null) return o.duration_minutes;
    }
    return t.duration ?? 0;
  };
  const isAvailableAtLocation = (t: Treatment) => {
    if (!locationId) return true;
    const rows = pricing.filter((p) => p.treatment_id === t.id);
    if (rows.length === 0) return true;
    return rows.some((p) => p.location_id === locationId && p.available);
  };

  const visibleTreatments = useMemo(
    () => treatments.filter(isAvailableAtLocation),
    [treatments, locationId, pricing],
  );
  const { roots, uncategorised } = useMemo(
    () => buildTree(categories, visibleTreatments),
    [categories, visibleTreatments],
  );

  const primaryLocation =
    locations.find((l) => l.is_primary) ?? locations[0] ?? null;

  const ig = profile.social_links?.instagram;

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }).share) {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: profile.clinic_name,
          url,
        });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  }

  const pageStyle: React.CSSProperties = {
    backgroundColor: bgColor,
    color: textColor,
    fontFamily: `${bodyFont}, system-ui, sans-serif`,
    ["--brand" as string]: brand,
    ["--brand-accent" as string]: accent,
  };
  const headingStyle: React.CSSProperties = {
    fontFamily: `${headingFont}, ${bodyFont}, system-ui, sans-serif`,
    color: brand,
  };

  const headerBg = theme?.header_bg_color || brand;
  const headerText = theme?.header_text_color || "#ffffff";
  const footerBg = theme?.footer_bg_color || brand;
  const footerText = theme?.footer_text_color || "#ffffff";
  const heroHeading = theme?.hero_heading;
  const heroSubheading = theme?.hero_subheading;
  const logoUrl = theme?.logo_url;

  return (
    <main className="min-h-screen pb-16" style={pageStyle}>
      {/* Hero image */}
      <div className="relative">
        {heroUrl ? (
          <img
            src={heroUrl}
            alt=""
            className="h-72 w-full object-cover object-top sm:h-[28rem]"
          />
        ) : (
          <div
            className="h-56 w-full sm:h-72"
            style={{ background: `linear-gradient(135deg, ${brand}, ${accent})` }}
          />
        )}
        {(heroHeading || heroSubheading) && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-6 sm:py-10">
            <div className="mx-auto max-w-3xl text-white">
              {heroHeading && (
                <h2
                  className="text-2xl font-extrabold leading-tight sm:text-4xl"
                  style={{ fontFamily: `${headingFont}, ${bodyFont}, system-ui, sans-serif` }}
                >
                  {heroHeading}
                </h2>
              )}
              {heroSubheading && (
                <p className="mt-2 max-w-2xl text-sm opacity-90 sm:text-base">{heroSubheading}</p>
              )}
            </div>
          </div>
        )}
      </div>


      {/* Overlapping title card */}
      <section className="relative z-10 mx-auto -mt-20 max-w-3xl px-4 sm:-mt-28">

        <div
          className="rounded-3xl border px-5 pb-5 pt-6 shadow-2xl sm:px-8 sm:pt-8"
          style={{ backgroundColor: bgColor, borderColor: `${brand}1a` }}
        >
          <h1
            className="text-3xl font-extrabold leading-tight sm:text-4xl"
            style={headingStyle}
          >
            {profile.clinic_name}
          </h1>
          {primaryLocation && (
            <p className="mt-2 text-base opacity-70">
              {primaryLocation.address_line1}
              {primaryLocation.city ? <br /> : null}
              {primaryLocation.city}
            </p>
          )}

          {/* Star rating */}
          {(() => {
            const count = reviews.length;
            const avg = count ? reviews.reduce((a, r) => a + r.rating, 0) / count : 0;
            const rounded = Math.round(avg);
            return (
              <Link
                to="/m/$slug/reviews"
                params={{ slug }}
                className="mt-3 flex items-center gap-2 hover:opacity-80"
              >
                <div className="flex" style={{ color: accent }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4"
                      fill={count === 0 || i < rounded ? "currentColor" : "none"}
                    />
                  ))}
                </div>
                <span className="text-sm opacity-70">
                  {count === 0
                    ? "Be the first to review"
                    : `${avg.toFixed(1)} · ${count} review${count === 1 ? "" : "s"}`}
                </span>
              </Link>
            );
          })()}


          {/* Action icon row */}
          <div className="mt-5 grid grid-cols-4 gap-2 border-t pt-4" style={{ borderColor: `${brand}22` }}>
            {ig ? (
              <ActionIcon
                href={ig.startsWith("http") ? ig : `https://instagram.com/${ig.replace("@", "")}`}
                label="Instagram"
                brand={brand}
              >
                <Instagram className="h-6 w-6" />
              </ActionIcon>
            ) : (
              <ActionPlaceholder label="Instagram" brand={brand}>
                <Instagram className="h-6 w-6 opacity-30" />
              </ActionPlaceholder>
            )}
            {primaryLocation && mapsUrl(primaryLocation) ? (
              <ActionIcon href={mapsUrl(primaryLocation)!} label="Directions" brand={brand}>
                <MapPin className="h-6 w-6" />
              </ActionIcon>
            ) : (
              <ActionPlaceholder label="Directions" brand={brand}>
                <MapPin className="h-6 w-6 opacity-30" />
              </ActionPlaceholder>
            )}
            <ActionButton onClick={handleShare} label="Share" brand={brand}>
              <Share2 className="h-6 w-6" />
            </ActionButton>
            <ActionLink to="/m/$slug/about" params={{ slug }} label="About" brand={brand}>
              <Info className="h-6 w-6" />
            </ActionLink>
          </div>
        </div>
      </section>

      {/* Team Members / Locations */}
      {locations.length > 0 && (
        <section className="mx-auto mt-8 max-w-3xl px-4">
          <h2 className="mb-4 text-xl font-bold" style={headingStyle}>
            {locations.length > 1 ? "Team Members" : "Your practitioner"}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {locations.map((loc) => {
              const selected = loc.id === locationId;
              const photo = loc.image_url || profile.avatar_url;
              return (
                <button
                  key={loc.id}
                  onClick={() => setLocationId(loc.id)}
                  className="group flex flex-col items-center rounded-2xl p-3 text-center transition hover:bg-black/[0.03]"
                  style={selected ? { boxShadow: `0 0 0 2px ${brand}` } : undefined}
                >
                  {photo ? (
                    <img
                      src={photo}
                      alt={loc.name}
                      className="h-24 w-24 rounded-full object-cover sm:h-28 sm:w-28"
                    />
                  ) : (
                    <div
                      className="flex h-24 w-24 items-center justify-center rounded-full text-2xl font-bold text-white sm:h-28 sm:w-28"
                      style={{ backgroundColor: brand }}
                    >
                      {(profile.full_name ?? profile.clinic_name).charAt(0)}
                    </div>
                  )}
                  <div className="mt-3 text-base font-bold uppercase leading-tight" style={{ color: brand }}>
                    {loc.name}
                    {loc.is_primary && (
                      <Star className="ml-1 inline h-3 w-3" fill="currentColor" />
                    )}
                  </div>
                  <div className="mt-1 text-sm font-medium leading-tight opacity-80" style={{ color: brand }}>
                    {profile.full_name ?? "Practitioner"}
                  </div>
                  {formatAddress(loc) && (
                    <div className="mt-1 text-xs opacity-70">
                      {formatAddress(loc)}
                    </div>
                  )}

                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Treatments */}
      {locationId ? (
        <section className="mx-auto mt-10 max-w-3xl px-4">
          <h2 className="mb-4 text-xl font-bold" style={headingStyle}>
            Book a treatment
          </h2>
          {visibleTreatments.length === 0 ? (
            <p className="opacity-70">No treatments available here yet.</p>
          ) : (
            <div className="space-y-2">
              {roots.length > 0 && (
                <CategoryTree
                  nodes={roots}
                  slug={slug}
                  priceFor={priceFor}
                  durationFor={durationFor}
                  brand={brand}
                />
              )}
              {uncategorised.length > 0 && (
                <div className="mt-4 space-y-2">
                  {roots.length > 0 && (
                    <h3 className="text-sm font-semibold uppercase tracking-wide opacity-60">
                      Other treatments
                    </h3>
                  )}
                  {uncategorised.map((t) => (
                    <TreatmentRow
                      key={t.id}
                      t={t}
                      slug={slug}
                      price={priceFor(t)}
                      duration={durationFor(t)}
                      brand={brand}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        locations.length > 1 && (
          <section className="mx-auto mt-8 max-w-3xl px-4">
            <p className="rounded-2xl border border-dashed p-6 text-center text-sm opacity-70"
               style={{ borderColor: `${brand}33` }}>
              Pick a team member above to see available treatments.
            </p>
          </section>
        )
      )}

      {packages.length > 0 && locationId && (
        <section className="mx-auto mt-10 max-w-3xl px-4">
          <h2 className="mb-3 text-xl font-bold" style={headingStyle}>
            Packages
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {packages.map((p) => (
              <Card key={p.id} className="rounded-2xl">
                <CardContent className="p-4">
                  <div className="font-semibold" style={{ color: brand }}>{p.name}</div>
                  <p className="mt-1 text-sm opacity-70">{p.session_count} sessions</p>
                  <p className="mt-2 font-bold" style={{ color: brand }}>
                    £{Number(p.price ?? 0).toFixed(2)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer
        className="mt-16 w-full px-4 py-6 text-center text-xs"
        style={{ backgroundColor: footerBg, color: footerText }}
      >
        © {new Date().getFullYear()} {profile.clinic_name} · Powered by MODO Book
      </footer>
    </main>
  );
}

function ActionPlaceholder({
  label,
  brand,
  children,
}: {
  label: string;
  brand: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-xs font-medium opacity-50" style={{ color: brand }}>
      {children}
      <span>{label}</span>
    </div>
  );
}


function ActionIcon({
  href,
  label,
  brand,
  children,
}: {
  href: string;
  label: string;
  brand: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-xs font-medium transition hover:bg-muted"
      style={{ color: brand }}
    >
      {children}
      <span>{label}</span>
    </a>
  );
}

function ActionButton({
  onClick,
  label,
  brand,
  children,
}: {
  onClick: () => void;
  label: string;
  brand: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-xs font-medium transition hover:bg-muted"
      style={{ color: brand }}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function ActionLink({
  to,
  params,
  label,
  brand,
  children,
}: {
  to: "/m/$slug/about";
  params: { slug: string };
  label: string;
  brand: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      params={params}
      className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-xs font-medium transition hover:bg-muted"
      style={{ color: brand }}
    >
      {children}
      <span>{label}</span>
    </Link>
  );
}

function CategoryTree({
  nodes,
  slug,
  priceFor,
  durationFor,
  brand,
  depth = 0,
}: {
  nodes: CatNode[];
  slug: string;
  priceFor: (t: Treatment) => number;
  durationFor: (t: Treatment) => number;
  brand: string;
  depth?: number;
}) {
  const visible = nodes.filter(
    (n) => n.treatments.length > 0 || n.children.some((c) => countTreatments(c) > 0),
  );
  if (visible.length === 0) return null;

  return (
    <Accordion
      type="multiple"
      className={
        depth === 0
          ? "divide-y rounded-2xl border bg-card"
          : "divide-y border-t"
      }
    >
      {visible.map((node) => {
        const count = countTreatments(node);
        return (
          <AccordionItem key={node.id} value={node.id} className="border-b-0 px-4">
            <AccordionTrigger className="py-4 hover:no-underline">
              <div className="flex-1 text-left">
                <div
                  className="text-base font-bold sm:text-lg"
                  style={{ color: brand }}
                >
                  {node.icon ? `${node.icon} ` : ""}
                  {node.name}
                </div>
                {node.description && (
                  <div className="mt-0.5 text-sm font-normal text-muted-foreground">
                    {node.description}
                  </div>
                )}
                <div className="mt-1 text-xs font-normal text-muted-foreground">
                  {count} {count === 1 ? "option" : "options"}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pb-4">
              {node.children.length > 0 && (
                <CategoryTree
                  nodes={node.children}
                  slug={slug}
                  priceFor={priceFor}
                  durationFor={durationFor}
                  brand={brand}
                  depth={depth + 1}
                />
              )}
              {node.treatments.map((t) => (
                <TreatmentRow
                  key={t.id}
                  t={t}
                  slug={slug}
                  price={priceFor(t)}
                  duration={durationFor(t)}
                  brand={brand}
                />
              ))}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

function TreatmentRow({
  t,
  slug,
  price,
  duration,
  brand,
}: {
  t: Treatment;
  slug: string;
  price: number;
  duration: number;
  brand: string;
}) {
  return (
    <Link
      to="/m/$slug/book/$treatmentId"
      params={{ slug, treatmentId: t.id }}
      className="group flex items-center justify-between gap-3 rounded-xl border bg-card p-3 transition hover:shadow-sm"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold" style={{ color: brand }}>
          {t.name}
        </div>
        {t.description && (
          <div className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {t.description}
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {duration} min
          </span>
          <span className="font-semibold" style={{ color: brand }}>
            {price === 0 ? "Free" : `£${price.toFixed(2)}`}
          </span>
        </div>
      </div>
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white transition group-hover:scale-105"
        style={{ backgroundColor: brand }}
        aria-label="Book"
      >
        <ChevronRight className="h-5 w-5" />
      </div>
    </Link>
  );
}
