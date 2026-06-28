import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  
  ExternalLink,
  Star,
  Check,
  Package as PackageIcon,
  Sparkles,
  MessageCircle,
  Facebook,
  Phone,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { mapsUrl, formatAddress } from "@/lib/maps";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { SafeHtml } from "@/components/SafeHtml";
import { describeCancellationRules } from "@/lib/policy";

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
  const { profile, treatments, packages, locations, categories, pricing, theme, reviews, concernAreas, concerns, concernLinks, modelSlots = [], addonLinks = [], practitioners = [], locationPractitioners = [] } =
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
        contact_sms_number?: string | null;
        contact_whatsapp_number?: string | null;

        welcome_intro_html?: string | null;
        deposit_amount_cents?: number | null;
        deposit_policy_text?: string | null;
        cancellation_rules?: { hours_before: number; fee_percent: number }[] | null;
        chooser_enabled?: boolean | null;
        chooser_show_know?: boolean | null;
        chooser_show_unsure?: boolean | null;
        chooser_show_consultation?: boolean | null;
        chooser_consultation_treatment_id?: string | null;
        chooser_intro_text?: string | null;
        model_slots_position?: "top" | "bottom" | null;
        practitioner_selection_mode?: "required" | "optional" | "first_available" | null;
      };
      treatments: Treatment[];
      packages: Package[];
      locations: (Location & { image_url?: string | null })[];
      categories: Category[];
      pricing: Pricing[];
      theme: Theme | null;
      reviews: { id: string; rating: number }[];
      concernAreas: { id: string; name: string; sort_order: number }[];
      concerns: { id: string; area_id: string; name: string; description: string | null }[];
      concernLinks: { concern_id: string; treatment_id: string }[];
      modelSlots?: {
        id: string; treatment_id: string; location_id: string | null;
        slot_date: string; start_time: string; end_time: string;
        price_mode: "fixed" | "percent"; price_value: number; notes: string | null;
        category?: string | null;
      }[];
      addonLinks?: { treatment_id: string; addon_id: string; discount_percent: number | null; discount_amount: number | null }[];
      practitioners?: { id: string; name: string; professional_title: string | null; photo_url: string | null; bio: string | null; display_order: number }[];
      locationPractitioners?: { location_id: string; practitioner_id: string; display_order: number }[];
    };


  const { slug } = useParams({ from: "/m/$slug/" });
  const brand = theme?.primary_color || profile.brand_color || "#1f2a44";
  const accent = theme?.accent_color || brand;
  const bgColor = theme?.background_color || "#ffffff";
  const textColor = theme?.text_color || "#0f172a";
  const headingFont = theme?.heading_font || "Inter";
  const bodyFont = theme?.body_font || "Inter";
  const heroUrl = theme?.hero_image_url || profile.hero_url;
  const layoutKey = (theme?.layout_key as "classic" | "carousel" | "split" | "magazine" | null) || "classic";
  const rawCarousel = (theme as { hero_carousel_urls?: unknown } | null)?.hero_carousel_urls;
  const carouselUrls: string[] = Array.isArray(rawCarousel)
    ? (rawCarousel as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const carouselEnabled =
    !!(theme as { hero_carousel_enabled?: boolean } | null)?.hero_carousel_enabled ||
    (layoutKey === "carousel" && carouselUrls.length > 0);
  // Menu styling
  const menuCardBg = theme?.menu_card_bg || "#ffffff";
  const menuCardBorder = theme?.menu_card_border_color || `${brand}1f`;
  const menuCatBg = theme?.menu_category_bg || brand;
  const menuCatText = theme?.menu_category_text || "#ffffff";
  const menuNameColor = theme?.menu_treatment_name_color || brand;
  const menuPriceColor = theme?.menu_price_color || brand;
  const menuSize = (theme?.menu_treatment_size as "sm" | "md" | "lg") || "sm";
  const menuTreatmentBold = theme?.menu_treatment_bold ?? true;
  const menuCategoryBold = theme?.menu_category_bold ?? true;

  const [locationId, setLocationId] = useState<string | null>(null);
  const practSelectionMode = profile.practitioner_selection_mode ?? "optional";
  const [practitionerId, setPractitionerIdState] = useState<string | null>(null);
  const setPractitionerId = (id: string | null) => {
    setPractitionerIdState(id);
    if (typeof window !== "undefined") {
      const key = `modo:practitionerId:${slug}`;
      if (id) window.sessionStorage.setItem(key, id);
      else window.sessionStorage.removeItem(key);
    }
  };
  // Clear practitioner when location changes
  useEffect(() => {
    setPractitionerId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);
  // Auto-pick first available when configured
  useEffect(() => {
    if (practSelectionMode !== "first_available" || !locationId) return;
    const first = locationPractitioners
      .filter((lp) => lp.location_id === locationId)
      .sort((a, b) => a.display_order - b.display_order)
      .map((lp) => practitioners.find((p) => p.id === lp.practitioner_id))
      .filter((p): p is NonNullable<typeof p> => !!p)[0];
    if (first) setPractitionerId(first.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, practSelectionMode]);
  // Block book links when practitioner required but not picked
  useEffect(() => {
    if (practSelectionMode !== "required") return;
    function onClick(e: MouseEvent) {
      if (practitionerId) return;
      const t = e.target as HTMLElement | null;
      const a = t?.closest?.("a") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (href.includes("/book/") || href.includes("/book-multi")) {
        e.preventDefault();
        e.stopPropagation();
        toast.error("Please choose a practitioner first");
        document.querySelector("[data-section='locations']")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [practSelectionMode, practitionerId]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const treatById = useMemo(() => new Map(treatments.map((t) => [t.id, t])), [treatments]);
  const addonsFor = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const link of addonLinks) {
      if (!m.has(link.treatment_id)) m.set(link.treatment_id, []);
      m.get(link.treatment_id)!.push(link.addon_id);
    }
    return m;
  }, [addonLinks]);

  const [addonPrompt, setAddonPrompt] = useState<{ treatmentId: string; addonIds: string[] } | null>(null);
  const [addonPicks, setAddonPicks] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      // Adding: check for add-ons
      const t = treatById.get(id);
      const mode = (t as { addon_mode?: string } | undefined)?.addon_mode ?? "optional";
      const candidates = (addonsFor.get(id) ?? []).filter((aid) => treatById.has(aid) && !prev.includes(aid));
      if (mode === "optional" && candidates.length > 0) {
        setAddonPicks(new Set());
        setAddonPrompt({ treatmentId: id, addonIds: candidates });
      }
      return [...prev, id];
    });
  };
  const isSelected = (id: string) => selectedIds.includes(id);


  // Chooser flow
  const chooserOn = !!profile.chooser_enabled;
  const showKnow = profile.chooser_show_know !== false;
  const showUnsure = profile.chooser_show_unsure !== false;
  const showConsult = profile.chooser_show_consultation !== false;
  const consultTreatmentId = profile.chooser_consultation_treatment_id ?? null;
  const [mode, setMode] = useState<null | "know" | "unsure">(null);
  const [pickedConcernId, setPickedConcernId] = useState<string | null>(null);

  // Clear selection when location changes
  const setLocAndClear = (id: string | null) => {
    setLocationId(id);
    setSelectedIds([]);
    setMode(null);
    setPickedConcernId(null);
  };
  void setLocAndClear;



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
      {/* Hero image / carousel (layout: {layoutKey}) */}
      <div className="relative">
        {layoutKey === "magazine" ? (
          heroUrl ? (
            <img src={heroUrl} alt="" className="h-32 w-full object-cover sm:h-40" />
          ) : (
            <div className="h-20 w-full" style={{ background: `linear-gradient(135deg, ${brand}, ${accent})` }} />
          )
        ) : carouselEnabled && carouselUrls.length > 0 ? (
          <HeroCarousel urls={carouselUrls} />
        ) : heroUrl ? (
          <img
            src={heroUrl}
            alt=""
            className={
              layoutKey === "split"
                ? "h-56 w-full object-cover object-top sm:h-80"
                : "h-72 w-full object-cover object-top sm:h-[28rem]"
            }
          />
        ) : (
          <div
            className="h-56 w-full sm:h-72"
            style={{ background: `linear-gradient(135deg, ${brand}, ${accent})` }}
          />
        )}
        {layoutKey !== "magazine" && (heroHeading || heroSubheading) && (
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
      <section
        className={
          layoutKey === "magazine"
            ? "relative z-10 mx-auto mt-6 max-w-3xl px-4"
            : layoutKey === "split"
              ? "relative z-10 mx-auto -mt-10 max-w-3xl px-4 sm:-mt-16"
              : "relative z-10 mx-auto -mt-20 max-w-3xl px-4 sm:-mt-28"
        }
      >


        <div
          className="rounded-3xl border px-5 pb-5 pt-6 shadow-2xl sm:px-8 sm:pt-8"
          style={{ backgroundColor: bgColor, borderColor: `${brand}1a` }}
        >
          {logoUrl && (
            <img
              src={logoUrl}
              alt={profile.clinic_name}
              className="mb-3 h-14 w-auto object-contain sm:h-16"
            />
          )}
          <h1
            className="text-3xl font-extrabold leading-tight sm:text-4xl"
            style={headingStyle}
          >
            {profile.clinic_name}
          </h1>


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

      {/* Contact us */}
      {(() => {
        const sms = profile.contact_sms_number?.trim();
        const wa = profile.contact_whatsapp_number?.trim();
        const fb = profile.social_links?.facebook?.trim();
        const igLink = ig?.trim();
        const items: { href: string; label: string; sub?: string; Icon: typeof Phone }[] = [];
        if (sms) items.push({ href: `sms:${sms}`, label: "Text us", sub: sms, Icon: Phone });
        if (wa) items.push({ href: `https://wa.me/${wa.replace(/[^0-9]/g, "")}`, label: "WhatsApp", sub: wa, Icon: MessageCircle });
        if (igLink) items.push({ href: igLink.startsWith("http") ? igLink : `https://instagram.com/${igLink.replace("@", "")}`, label: "Instagram", sub: igLink, Icon: Instagram });
        if (fb) items.push({ href: fb.startsWith("http") ? fb : `https://facebook.com/${fb}`, label: "Facebook", sub: fb.replace(/^https?:\/\//, ""), Icon: Facebook });
        if (items.length === 0) return null;
        return (
          <section className="mx-auto mt-8 max-w-3xl px-4">
            <h2 className="mb-4 text-xl font-bold" style={headingStyle}>Get in touch</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {items.map((it) => (
                <a
                  key={it.label}
                  href={it.href}
                  target={it.href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition hover:shadow-md"
                  style={{ borderColor: `${brand}22`, color: textColor, backgroundColor: "var(--surface, transparent)" }}
                >
                  <span className="rounded-full p-3" style={{ backgroundColor: `${brand}14`, color: brand }}>
                    <it.Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium">{it.label}</span>
                  {it.sub ? <span className="text-xs opacity-70 truncate w-full">{it.sub}</span> : null}
                </a>
              ))}
            </div>
          </section>
        );
      })()}



      {/* Choose Location + practitioners */}
      {locations.length > 0 && (
        <section className="mx-auto mt-8 max-w-3xl px-4">
          <h2 className="mb-4 text-xl font-bold" style={headingStyle}>
            Choose Location
          </h2>
          <div className={`grid gap-4 ${locations.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
            {locations.map((loc) => {
              const selected = loc.id === locationId;
              const photo = loc.image_url || profile.avatar_url;
              const locPracts = locationPractitioners
                .filter((lp) => lp.location_id === loc.id)
                .sort((a, b) => a.display_order - b.display_order)
                .map((lp) => practitioners.find((p) => p.id === lp.practitioner_id))
                .filter((p): p is NonNullable<typeof p> => !!p);
              return (
                <div
                  key={loc.id}
                  className="rounded-2xl border p-4 transition"
                  style={{
                    borderColor: selected ? brand : `${brand}22`,
                    boxShadow: selected ? `0 0 0 2px ${brand}` : undefined,
                    backgroundColor: menuCardBg,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setLocationId(loc.id)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    {photo ? (
                      <img src={photo} alt={loc.name} className="h-16 w-16 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white" style={{ backgroundColor: brand }}>
                        {loc.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="text-base font-bold uppercase leading-tight" style={{ color: brand }}>
                        {loc.name}
                        {loc.is_primary && <Star className="ml-1 inline h-3 w-3" fill="currentColor" />}
                      </div>
                      {formatAddress(loc) && (
                        <div className="mt-1 text-xs opacity-70">{formatAddress(loc)}</div>
                      )}
                    </div>
                  </button>

                  {selected && locPracts.length > 0 && practSelectionMode !== "first_available" && (
                    <div className="mt-3 border-t pt-3" style={{ borderColor: `${brand}1a` }}>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-[10px] font-semibold uppercase tracking-wide opacity-55" style={{ color: brand }}>
                          {practSelectionMode === "required" ? "Choose Practitioner *" : "Choose Practitioner (optional)"}
                        </div>
                        {practSelectionMode === "optional" && practitionerId && (
                          <button
                            type="button"
                            onClick={() => setPractitionerId(null)}
                            className="text-[10px] underline opacity-60 hover:opacity-100"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="grid gap-2">
                        {locPracts.map((p) => {
                          const isPicked = practitionerId === p.id;
                          return (
                            <button
                              type="button"
                              key={p.id}
                              onClick={() => setPractitionerId(isPicked ? null : p.id)}
                              className="flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition"
                              style={{
                                borderColor: isPicked ? brand : `${brand}22`,
                                backgroundColor: isPicked ? `${brand}18` : `${brand}08`,
                                boxShadow: isPicked ? `0 0 0 1px ${brand}` : undefined,
                              }}
                            >
                              {p.photo_url ? (
                                <img src={p.photo_url} alt={p.name} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                              ) : (
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: brand }}>
                                  {p.name.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-semibold leading-tight" style={{ color: brand }}>
                                  {p.name}
                                </div>
                                {p.professional_title && (
                                  <div className="truncate text-[10px] leading-tight opacity-70">{p.professional_title}</div>
                                )}
                              </div>
                              {isPicked && (
                                <span className="text-[10px] font-semibold uppercase" style={{ color: brand }}>Selected</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {practSelectionMode === "required" && !practitionerId && (
                        <p className="mt-2 text-[11px] opacity-70">Please choose a practitioner to continue.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}


      {/* Welcome message */}
      {profile.welcome_intro_html && (
        <section className="mx-auto mt-8 max-w-3xl px-4">
          <div
            className="rounded-2xl border bg-card px-5 py-5 shadow-sm sm:px-7 sm:py-6"
            style={{ borderColor: `${brand}1a` }}
          >
            <SafeHtml
              html={profile.welcome_intro_html}
              className="prose prose-sm sm:prose max-w-none [&_strong]:font-bold"
            />
          </div>
        </section>
      )}

      {/* Booking & cancellation policy */}
      {(profile.deposit_policy_text || (profile.cancellation_rules && profile.cancellation_rules.length > 0) || (profile.deposit_amount_cents ?? 0) > 0) && (
        <section className="mx-auto mt-4 max-w-3xl px-4">
          <details className="rounded-2xl border bg-card px-5 py-4 text-sm sm:px-7" style={{ borderColor: `${brand}1a` }}>
            <summary className="cursor-pointer font-semibold" style={{ color: brand }}>
              Booking & cancellation policy
            </summary>
            <div className="mt-3 space-y-2 opacity-90">
              {(profile.deposit_amount_cents ?? 0) > 0 && (
                <p>A £{((profile.deposit_amount_cents ?? 0) / 100).toFixed(2)} deposit is taken at time of booking.</p>
              )}
              {profile.deposit_policy_text && <p>{profile.deposit_policy_text}</p>}
              {profile.cancellation_rules && profile.cancellation_rules.length > 0 && (
                <ul className="ml-4 list-disc space-y-1">
                  {describeCancellationRules(profile.cancellation_rules).map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </div>
          </details>
        </section>
      )}

      {/* Chooser gate */}
      {locationId && chooserOn && !mode && (
        <section className="mx-auto mt-10 max-w-3xl px-4">
          <h2 className="mb-1 text-center text-xl font-bold" style={headingStyle}>
            How can we help today?
          </h2>
          {profile.chooser_intro_text && (
            <p className="mb-5 text-center text-sm opacity-70">{profile.chooser_intro_text}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {showKnow && (
              <ChooserCard
                title="I know what I want"
                description="Browse the full treatment menu"
                brand={brand}
                onClick={() => setMode("know")}
              />
            )}
            {showUnsure && (
              <ChooserCard
                title="I'm unsure what to book"
                description="Pick a concern and we'll suggest treatments"
                brand={brand}
                onClick={() => setMode("unsure")}
              />
            )}
            {showConsult && (
              consultTreatmentId ? (
                <Link
                  to="/m/$slug/book/$treatmentId"
                  params={{ slug, treatmentId: consultTreatmentId }}
                  className="block"
                >
                  <ChooserCard
                    title="Book a consultation now"
                    description="Book a one-to-one consultation"
                    brand={brand}
                  />
                </Link>
              ) : (
                <ChooserCard
                  title="Book a consultation now"
                  description="Browse to find a consultation"
                  brand={brand}
                  onClick={() => setMode("know")}
                />
              )
            )}
          </div>
        </section>
      )}

      {/* Concerns picker (unsure path) */}
      {locationId && chooserOn && mode === "unsure" && !pickedConcernId && (
        <section className="mx-auto mt-10 max-w-3xl px-4">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => setMode(null)} className="text-sm opacity-70 hover:opacity-100">
              ← Back
            </button>
            <button onClick={() => setMode("know")} className="text-sm font-semibold" style={{ color: brand }}>
              Skip · show full menu
            </button>
          </div>
          <h2 className="mb-4 text-xl font-bold" style={headingStyle}>What's your main concern?</h2>
          {concernAreas.length === 0 ? (
            <p className="opacity-70">No concerns set up yet.</p>
          ) : (
            <div className="space-y-5">
              {concernAreas.map((area) => {
                const areaConcerns = concerns.filter((c) => c.area_id === area.id);
                if (areaConcerns.length === 0) return null;
                return (
                  <div key={area.id}>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide opacity-60">{area.name}</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {areaConcerns.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setPickedConcernId(c.id)}
                          className="rounded-xl border bg-card p-3 text-left transition hover:shadow-md"
                          style={{ borderColor: `${brand}33` }}
                        >
                          <div className="font-semibold" style={{ color: brand }}>{c.name}</div>
                          {c.description && (
                            <div className="mt-0.5 text-xs opacity-70">{c.description}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Treatments + Packages */}
      {locationId && (!chooserOn || mode === "know" || (mode === "unsure" && pickedConcernId)) ? (
        <section className="mx-auto mt-10 max-w-3xl px-4 pb-32">
          {chooserOn && (
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => {
                  if (mode === "unsure" && pickedConcernId) setPickedConcernId(null);
                  else setMode(null);
                }}
                className="text-sm opacity-70 hover:opacity-100"
              >
                ← Back
              </button>
              {mode === "unsure" && pickedConcernId && (
                <button onClick={() => { setMode("know"); setPickedConcernId(null); }} className="text-sm font-semibold" style={{ color: brand }}>
                  Show full menu
                </button>
              )}
            </div>
          )}
          {(() => {
            // If on concern path, filter to matched treatments
            const matchedIds =
              mode === "unsure" && pickedConcernId
                ? new Set(concernLinks.filter((l) => l.concern_id === pickedConcernId).map((l) => l.treatment_id))
                : null;
            const filteredTreatments = matchedIds
              ? visibleTreatments.filter((t) => matchedIds.has(t.id))
              : visibleTreatments;
            const tree = matchedIds ? buildTree(categories, filteredTreatments) : { roots, uncategorised };

            if (matchedIds) {
              const concernName = concerns.find((c) => c.id === pickedConcernId)?.name;
              return (
                <>
                  {concernName && (
                    <h2 className="mb-3 text-lg font-bold" style={headingStyle}>
                      Suggested for: {concernName}
                    </h2>
                  )}
                  {filteredTreatments.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-6 text-center text-sm opacity-70" style={{ borderColor: `${brand}33` }}>
                      No treatments matched to this concern yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filteredTreatments.map((t) => (
                        <TreatmentRow
                          key={t.id}
                          t={t}
                          slug={slug}
                          price={priceFor(t)}
                          duration={durationFor(t)}
                          brand={brand}
                          selected={isSelected(t.id)}
                          onToggle={() => toggleSelect(t.id)}
                          cardBg={menuCardBg}
                          cardBorder={menuCardBorder}
                          nameColor={menuNameColor}
                          priceColor={menuPriceColor}
                          size={menuSize}
                          bold={menuTreatmentBold}
                        />
                      ))}
                    </div>
                  )}
                </>
              );
            }

            return (
              <Tabs defaultValue="treatments" className="w-full">
                <TabsList className="grid w-full grid-cols-3" style={{ backgroundColor: `${brand}10` }}>
                  <TabsTrigger value="treatments">Treatments</TabsTrigger>
                  <TabsTrigger value="packages" disabled={packages.length === 0}>
                    <PackageIcon className="mr-1.5 h-4 w-4" />
                    Packages
                  </TabsTrigger>
                  <TabsTrigger value="concerns" disabled={concerns.length === 0}>
                    By concern
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="treatments" className="mt-4">
                  <p className="mb-3 text-xs opacity-60">
                    Tick all the treatments you'd like, then press Book Now.
                  </p>
                  {(() => {
                    const treatById = new Map(treatments.map((t) => [t.id, t]));
                    const slots = modelSlots
                      .filter((s) => !locationId || !s.location_id || s.location_id === locationId)
                      .filter((s) => treatById.has(s.treatment_id));
                    const modelPosition = profile.model_slots_position === "bottom" ? "bottom" : "top";

                    const groupedSlots: { category: string; items: typeof slots }[] = (() => {
                      if (slots.length === 0) return [];
                      const map = new Map<string, typeof slots>();
                      for (const s of slots) {
                        const key = (s.category && s.category.trim()) || "General";
                        if (!map.has(key)) map.set(key, [] as typeof slots);
                        map.get(key)!.push(s);
                      }
                      return Array.from(map.entries())
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([category, items]) => ({ category, items }));
                    })();

                    const modelBlock = slots.length === 0 ? null : (
                      <div
                        className={`${modelPosition === "top" ? "mb-5" : "mt-5"} rounded-2xl border-2 p-3`}
                        style={{ borderColor: `${brand}55`, backgroundColor: `${brand}08` }}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <Sparkles className="h-4 w-4" style={{ color: brand }} />
                          <h3 className="text-sm font-bold" style={{ color: brand }}>Model slots</h3>
                          <span className="text-xs opacity-60">Discounted dates & times</span>
                        </div>
                        <div className="space-y-3">
                          {groupedSlots.map((g) => (
                            <div key={g.category}>
                              {groupedSlots.length > 1 && (
                                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-70">{g.category}</p>
                              )}
                              <div className="grid gap-2 sm:grid-cols-2">
                                {g.items.map((s) => {
                                  const t = treatById.get(s.treatment_id)!;
                                  const base = priceFor(t);
                                  const final = s.price_mode === "fixed" ? Number(s.price_value) : Math.max(0, base * (1 - Number(s.price_value) / 100));
                                  return (
                                    <div key={s.id} className="rounded-xl border bg-white p-3">
                                      <p className="text-sm font-semibold">{t.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {new Date(s.slot_date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}
                                      </p>
                                      <p className="mt-1 text-sm">
                                        <span className="line-through text-muted-foreground">£{base.toFixed(2)}</span>{" "}
                                        <span className="font-bold text-emerald-600">£{final.toFixed(2)}</span>
                                      </p>
                                      {s.notes && <p className="mt-1 text-xs italic text-muted-foreground">{s.notes}</p>}
                                      <a
                                        href={`/m/${slug}/book/${t.id}?model=${s.id}`}
                                        className="mt-2 inline-block rounded-md px-3 py-1.5 text-xs font-semibold text-white"
                                        style={{ backgroundColor: brand }}
                                      >
                                        Book this slot
                                      </a>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );

                    const menuBlock = visibleTreatments.length === 0 ? (
                      <p className="opacity-70">No treatments available here yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {tree.roots.length > 0 && (
                          <CategoryTree
                            nodes={tree.roots}
                            slug={slug}
                            priceFor={priceFor}
                            durationFor={durationFor}
                            brand={brand}
                            isSelected={isSelected}
                            toggleSelect={toggleSelect}
                            catBg={menuCatBg}
                            catText={menuCatText}
                            cardBg={menuCardBg}
                            cardBorder={menuCardBorder}
                            nameColor={menuNameColor}
                            priceColor={menuPriceColor}
                            size={menuSize}
                            bold={menuTreatmentBold}
                            categoryBold={menuCategoryBold}
                            headingFont={headingFont}
                          />
                        )}
                        {tree.uncategorised.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {tree.roots.length > 0 && (
                              <h3 className="text-sm font-semibold uppercase tracking-wide opacity-60">
                                Other treatments
                              </h3>
                            )}
                            {tree.uncategorised.map((t) => (
                              <TreatmentRow
                                key={t.id}
                                t={t}
                                slug={slug}
                                price={priceFor(t)}
                                duration={durationFor(t)}
                                brand={brand}
                                selected={isSelected(t.id)}
                                onToggle={() => toggleSelect(t.id)}
                                cardBg={menuCardBg}
                                cardBorder={menuCardBorder}
                                nameColor={menuNameColor}
                                priceColor={menuPriceColor}
                                size={menuSize}
                                bold={menuTreatmentBold}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );

                    return modelPosition === "top" ? (
                      <>{modelBlock}{menuBlock}</>
                    ) : (
                      <>{menuBlock}{modelBlock}</>
                    );
                  })()}
                </TabsContent>


                <TabsContent value="packages" className="mt-4">
                  {packages.length === 0 ? (
                    <p className="opacity-70">No packages available.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {packages.map((p) => {
                        const pkg = p as Package & {
                          description?: string | null;
                          treatment_ids?: string[] | null;
                          duration_minutes?: number | null;
                          image_url?: string | null;
                        };
                        const ids = pkg.treatment_ids ?? (pkg.treatment_id ? [pkg.treatment_id] : []);
                        const firstTreatmentId = ids[0];
                        return (
                          <Card key={p.id} className="overflow-hidden rounded-2xl">
                            {pkg.image_url && (
                              <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                                <img src={pkg.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                              </div>
                            )}
                            <CardContent className="p-4">
                              <div className="font-semibold" style={{ color: brand }}>{p.name}</div>
                              {pkg.description && (
                                <p className="mt-1 line-clamp-3 text-sm opacity-70">{pkg.description}</p>
                              )}
                              <p className="mt-2 text-xs opacity-60">
                                {p.session_count} session{p.session_count === 1 ? "" : "s"}
                                {pkg.duration_minutes ? ` · ${pkg.duration_minutes} min each` : ""}
                              </p>
                              <div className="mt-3 flex items-center justify-between gap-2">
                                <p className="font-bold" style={{ color: brand }}>
                                  £{Number(p.price ?? 0).toFixed(2)}
                                </p>
                                {firstTreatmentId ? (
                                  <Link
                                    to="/m/$slug/book/$treatmentId"
                                    params={{ slug, treatmentId: firstTreatmentId }}
                                    className="rounded-full px-4 py-1.5 text-sm font-semibold text-white"
                                    style={{ backgroundColor: brand }}
                                  >
                                    Book
                                  </Link>
                                ) : (
                                  <span className="text-xs opacity-60">Contact to book</span>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="concerns" className="mt-4">
                  <p className="mb-3 text-xs opacity-60">
                    Not sure where to start? Pick a concern to see treatments we'd suggest.
                  </p>
                  {concernAreas.length === 0 ? (
                    <p className="opacity-70">No concerns set up yet.</p>
                  ) : (
                    <Accordion type="multiple" className="space-y-2">
                      {concernAreas.map((area) => {
                        const areaConcerns = concerns.filter((c) => c.area_id === area.id);
                        if (areaConcerns.length === 0) return null;
                        return (
                          <AccordionItem
                            key={area.id}
                            value={area.id}
                            className="rounded-xl border px-3"
                            style={{ borderColor: `${brand}33` }}
                          >
                            <AccordionTrigger className="text-sm font-semibold" style={{ color: brand }}>
                              {area.name}
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-3">
                                {areaConcerns.map((c) => {
                                  const matchedIds = new Set(
                                    concernLinks.filter((l) => l.concern_id === c.id).map((l) => l.treatment_id),
                                  );
                                  const matched = visibleTreatments.filter((t) => matchedIds.has(t.id));
                                  return (
                                    <div key={c.id} className="rounded-lg border bg-card p-3" style={{ borderColor: `${brand}1f` }}>
                                      <div className="font-semibold" style={{ color: brand }}>{c.name}</div>
                                      {c.description && (
                                        <div className="mt-0.5 text-xs opacity-70">{c.description}</div>
                                      )}
                                      {matched.length === 0 ? (
                                        <p className="mt-2 text-xs opacity-60">No treatments linked yet.</p>
                                      ) : (
                                        <div className="mt-2 space-y-1.5">
                                          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-60">Suggested treatments</p>
                                          {matched.map((t) => (
                                            <TreatmentRow
                                              key={t.id}
                                              t={t}
                                              slug={slug}
                                              price={priceFor(t)}
                                              duration={durationFor(t)}
                                              brand={brand}
                                              selected={isSelected(t.id)}
                                              onToggle={() => toggleSelect(t.id)}
                                              cardBg={menuCardBg}
                                              cardBorder={menuCardBorder}
                                              nameColor={menuNameColor}
                                              priceColor={menuPriceColor}
                                              size={menuSize}
                                              bold={menuTreatmentBold}
                                            />
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}
                </TabsContent>
              </Tabs>
            );
          })()}
        </section>
      ) : !locationId ? (
        locations.length > 1 && (
          <section className="mx-auto mt-8 max-w-3xl px-4">
            <p className="rounded-2xl border border-dashed p-6 text-center text-sm opacity-70"
               style={{ borderColor: `${brand}33` }}>
              Pick a location above to see available treatments.
            </p>
          </section>
        )
      ) : null}


      {/* Sticky multi-select bar */}
      {locationId && selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur" style={{ borderColor: `${brand}33` }}>
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-semibold" style={{ color: brand }}>
                {selectedIds.length} treatment{selectedIds.length === 1 ? "" : "s"} selected
              </div>
              <div className="text-xs opacity-70">
                Total £
                {selectedIds
                  .map((id) => priceFor(treatments.find((t) => t.id === id)!))
                  .reduce((a, b) => a + b, 0)
                  .toFixed(2)}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                Clear
              </Button>
              <Link to="/m/$slug/book-multi" params={{ slug }} search={{ ids: selectedIds.join(",") }}>
                <Button size="sm" style={{ backgroundColor: brand, color: "#fff" }}>
                  Continue →
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}



      {/* Footer */}
      <footer
        className="mt-16 w-full px-4 py-6 text-center text-xs"
        style={{ backgroundColor: footerBg, color: footerText }}
      >
        © {new Date().getFullYear()} {profile.clinic_name} · Powered by MODO Book
      </footer>

      {/* Add-on prompt */}
      {addonPrompt && (() => {
        const parent = treatById.get(addonPrompt.treatmentId);
        const addons = addonPrompt.addonIds
          .map((id) => treatById.get(id))
          .filter(Boolean) as Treatment[];
        const close = (apply: boolean) => {
          if (apply && addonPicks.size > 0) {
            setSelectedIds((prev) => {
              const next = [...prev];
              for (const id of addonPicks) if (!next.includes(id)) next.push(id);
              return next;
            });
          }
          setAddonPrompt(null);
          setAddonPicks(new Set());
        };
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3" onClick={() => close(false)}>
            <div className="w-full max-w-md rounded-2xl bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-1 text-base font-semibold" style={{ color: textColor, fontFamily: headingFont }}>
                Add to {parent?.name}?
              </div>
              <div className="mb-4 text-xs text-muted-foreground">
                Pick any add-ons below or continue without.
              </div>
              <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                {addons.map((a) => {
                  const checked = addonPicks.has(a.id);
                  const link = addonLinks.find(
                    (l) => l.treatment_id === addonPrompt.treatmentId && l.addon_id === a.id,
                  );
                  const pct = link?.discount_percent ?? null;
                  const basePrice = Number(a.price ?? 0);
                  const finalPrice = pct ? basePrice * (1 - pct / 100) : basePrice;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setAddonPicks((prev) => {
                          const n = new Set(prev);
                          if (n.has(a.id)) n.delete(a.id); else n.add(a.id);
                          return n;
                        });
                      }}
                      className="flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-left transition hover:shadow-sm"
                      style={{
                        backgroundColor: menuCardBg,
                        borderColor: checked ? brand : menuCardBorder,
                        boxShadow: checked ? `0 0 0 1.5px ${brand}` : undefined,
                      }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium" style={{ color: menuNameColor }}>{a.name}</div>
                        {a.description && (
                          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.description}</div>
                        )}
                        <div className="mt-1 text-[11px] text-muted-foreground">+{a.duration} min</div>
                        {pct ? (
                          <div className="mt-1 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            {pct}% off add-on
                          </div>
                        ) : null}
                      </div>
                      <div className="whitespace-nowrap text-sm font-semibold text-right" style={{ color: menuPriceColor }}>
                        {pct ? (
                          <>
                            <span className="block text-xs text-muted-foreground line-through">+£{basePrice.toFixed(2)}</span>
                            +£{finalPrice.toFixed(2)}
                          </>
                        ) : (
                          <>+£{basePrice.toFixed(2)}</>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="rounded-full border px-4 py-2 text-sm"
                  style={{ borderColor: menuCardBorder, color: textColor }}
                >
                  No thanks
                </button>
                <button
                  type="button"
                  onClick={() => close(true)}
                  disabled={addonPicks.size === 0}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: brand }}
                >
                  Add {addonPicks.size > 0 ? `${addonPicks.size} ` : ""}add-on{addonPicks.size === 1 ? "" : "s"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}


function ChooserCard({
  title,
  description,
  brand,
  onClick,
}: {
  title: string;
  description: string;
  brand: string;
  onClick?: () => void;
}) {
  const inner = (
    <div
      className="flex h-full flex-col rounded-2xl border bg-card p-5 text-left transition hover:shadow-lg"
      style={{ borderColor: `${brand}33` }}
    >
      <div className="text-base font-bold leading-tight" style={{ color: brand }}>{title}</div>
      <div className="mt-1 text-sm opacity-75">{description}</div>
      <div className="mt-3 text-sm font-semibold" style={{ color: brand }}>Continue →</div>
    </div>
  );
  if (onClick) return <button onClick={onClick} className="block w-full text-left">{inner}</button>;
  return inner;
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

type MenuStyleProps = {
  cardBg: string;
  cardBorder: string;
  nameColor: string;
  priceColor: string;
  size: "sm" | "md" | "lg";
  bold: boolean;
};

function CategoryTree({
  nodes,
  slug,
  priceFor,
  durationFor,
  brand,
  depth = 0,
  isSelected,
  toggleSelect,
  catBg,
  catText,
  cardBg,
  cardBorder,
  nameColor,
  priceColor,
  size,
  bold,
  categoryBold,
  headingFont,
}: {
  nodes: CatNode[];
  slug: string;
  priceFor: (t: Treatment) => number;
  durationFor: (t: Treatment) => number;
  brand: string;
  depth?: number;
  isSelected: (id: string) => boolean;
  toggleSelect: (id: string) => void;
  catBg: string;
  catText: string;
  cardBg: string;
  cardBorder: string;
  nameColor: string;
  priceColor: string;
  size: "sm" | "md" | "lg";
  bold: boolean;
  categoryBold: boolean;
  headingFont: string;
}) {
  const visible = nodes.filter(
    (n) => n.treatments.length > 0 || n.children.some((c) => countTreatments(c) > 0),
  );
  if (visible.length === 0) return null;

  return (
    <div className={depth === 0 ? "space-y-4" : "space-y-3"}>
      {visible.map((node) => {
        const count = countTreatments(node);
        const isSub = depth > 0;
        return (
          <Accordion key={node.id} type="single" collapsible>
            <AccordionItem value={node.id} className="overflow-hidden rounded-2xl border-0 shadow-sm">
              <AccordionTrigger
                className="px-5 py-4 hover:no-underline [&[data-state=open]>svg]:rotate-180"
                style={
                  isSub
                    ? { backgroundColor: `${catBg}1a`, color: catBg }
                    : { backgroundColor: catBg, color: catText, fontFamily: `${headingFont}, system-ui, sans-serif` }
                }
              >
                <div className="flex-1 text-left">
                  <div
                    className={`leading-tight ${isSub ? "text-base" : "text-lg sm:text-xl"} ${categoryBold ? "font-extrabold" : "font-medium"}`}
                  >
                    {node.icon ? `${node.icon} ` : ""}
                    {node.name}
                  </div>
                  {node.description && (
                    <div className="mt-0.5 text-xs font-normal opacity-80">{node.description}</div>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent
                className="space-y-2 px-2 pb-3 pt-3"
                style={{ backgroundColor: isSub ? "transparent" : `${catBg}08` }}
              >
                {node.children.length > 0 && (
                  <CategoryTree
                    nodes={node.children}
                    slug={slug}
                    priceFor={priceFor}
                    durationFor={durationFor}
                    brand={brand}
                    depth={depth + 1}
                    isSelected={isSelected}
                    toggleSelect={toggleSelect}
                    catBg={catBg}
                    catText={catText}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    nameColor={nameColor}
                    priceColor={priceColor}
                    size={size}
                    bold={bold}
                    categoryBold={categoryBold}
                    headingFont={headingFont}
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
                    selected={isSelected(t.id)}
                    onToggle={() => toggleSelect(t.id)}
                    cardBg={cardBg}
                    cardBorder={cardBorder}
                    nameColor={nameColor}
                    priceColor={priceColor}
                    size={size}
                    bold={bold}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        );
      })}
    </div>
  );
}

function TreatmentRow({
  t,
  price,
  duration,
  brand,
  selected,
  onToggle,
  cardBg,
  cardBorder,
  nameColor,
  priceColor,
  size,
  bold,
}: {
  t: Treatment;
  slug: string;
  price: number;
  duration: number;
  brand: string;
  selected: boolean;
  onToggle: () => void;
} & MenuStyleProps) {
  const [expanded, setExpanded] = useState(false);
  const desc = t.description ?? "";
  const isLong = desc.length > 110;
  const shown = expanded || !isLong ? desc : desc.slice(0, 110).trimEnd() + " …";

  const padding = size === "lg" ? "p-4" : size === "md" ? "p-3.5" : "p-3";
  const nameSize = size === "lg" ? "text-base sm:text-lg" : size === "md" ? "text-[15px] sm:text-base" : "text-sm sm:text-[15px]";
  const priceSize = size === "lg" ? "text-base" : "text-sm";
  const checkSize = size === "lg" ? "h-6 w-6" : "h-5 w-5";

  return (
    <div
      className={`group flex w-full items-start gap-3 rounded-xl border transition hover:shadow-sm ${padding}`}
      style={{
        backgroundColor: cardBg,
        borderColor: selected ? brand : cardBorder,
        boxShadow: selected ? `0 0 0 1.5px ${brand}` : undefined,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        aria-label={selected ? "Deselect" : "Select"}
        className={`mt-0.5 flex flex-shrink-0 items-center justify-center rounded-full border-2 transition ${checkSize}`}
        style={
          selected
            ? { backgroundColor: brand, borderColor: brand, color: "#fff" }
            : { borderColor: `${brand}66` }
        }
      >
        {selected && <Check className="h-3 w-3" />}
      </button>
      <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className={`leading-tight ${nameSize} ${bold ? "font-bold" : "font-medium"}`} style={{ color: nameColor }}>
            {t.name}
          </div>
          {(() => {
            const pct = (t as any).discount_percent as number | null;
            const startsAt = (t as any).discount_starts_at as string | null;
            const endsAt = (t as any).discount_ends_at as string | null;
            const dows = (t as any).discount_days_of_week as number[] | null;
            const now = new Date();
            const inWindow = (!startsAt || new Date(startsAt) <= now)
              && (!endsAt || new Date(endsAt) >= now)
              && (!dows || dows.length === 0 || dows.includes(now.getDay()));
            const hasDisc = pct != null && pct > 0 && inWindow && price > 0;
            const discounted = hasDisc ? price * (1 - pct / 100) : price;
            return (
              <div className={`whitespace-nowrap ${priceSize} ${bold ? "font-bold" : "font-semibold"}`} style={{ color: priceColor }}>
                {hasDisc && ((t as any).discount_show_was_now !== false) && (
                  <span className="mr-1.5 text-xs font-normal text-muted-foreground line-through">£{price.toFixed(2)}</span>

                )}
                {discounted === 0 ? "Free" : `£${discounted.toFixed(2)}`}
                {hasDisc && (
                  <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">−{pct}%</span>
                )}
              </div>
            );
          })()}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{duration} min</span>
        </div>
        {desc && (
          <div className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
            {shown}
            {isLong && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                className="ml-1 font-semibold hover:underline"
                style={{ color: brand }}
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}
      </button>
    </div>
  );
}



function HeroCarousel({ urls }: { urls: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (urls.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % urls.length), 4500);
    return () => clearInterval(t);
  }, [urls.length]);
  return (
    <div className="relative h-72 w-full overflow-hidden sm:h-[28rem]">
      {urls.map((u, idx) => (
        <img
          key={u + idx}
          src={u}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-700 ${idx === i ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      {urls.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {urls.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Slide ${idx + 1}`}
              onClick={() => setI(idx)}
              className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-white" : "w-1.5 bg-white/60"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
