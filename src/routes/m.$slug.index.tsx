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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { mapsUrl, formatAddress } from "@/lib/maps";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { SafeHtml } from "@/components/SafeHtml";
import { resolveDisplayNames } from "@/lib/display-name";
import { formatPrice, BADGE_LABEL, badgeClasses, type TreatmentBadge } from "@/lib/price-display";


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

function formatSessionSpacing(days?: number | null) {
  if (!days || days <= 0) return null;
  if (days % 7 === 0) {
    const weeks = days / 7;
    return `every ${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  return `every ${days} day${days === 1 ? "" : "s"}`;
}

function formatTreatmentSessions(t: Treatment) {
  const sessions = (t as { session_count?: number | null }).session_count ?? 1;
  if (sessions <= 1) return null;
  const spacing = formatSessionSpacing((t as { session_interval_days?: number | null }).session_interval_days);
  return `${sessions} sessions${spacing ? ` · ${spacing}` : ""}`;
}

function textToParagraphHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function WelcomeIntroBlock({
  heading,
  html,
  headingStyle,
  brand,
  expandable,
  variant,
}: {
  heading: string;
  html: string;
  headingStyle: React.CSSProperties;
  brand: string;
  expandable: boolean;
  variant: "mobile" | "desktop";
}) {
  const [expanded, setExpanded] = useState(false);
  const proseCls =
    variant === "mobile"
      ? "prose prose-sm max-w-none [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_p]:leading-relaxed [&_p]:my-3 [&_p:empty]:min-h-[1em] [&_p:empty]:block [&_br]:block [&_strong]:font-bold"
      : "prose prose-base sm:prose-lg max-w-none [&_h1]:text-3xl [&_h2]:text-2xl [&_h3]:text-xl [&_p]:leading-relaxed [&_p]:my-3 [&_p:empty]:min-h-[1em] [&_p:empty]:block [&_br]:block [&_strong]:font-bold";
  const collapsed = expandable && !expanded;
  return (
    <>
      {heading && (
        <h2
          className={
            variant === "mobile"
              ? "mb-3 text-xl font-bold leading-tight"
              : "mb-3 text-2xl font-bold leading-tight sm:text-3xl"
          }
          style={headingStyle}
        >
          {heading}
        </h2>
      )}
      {html && (
        <div className="relative">
          <div
            className={collapsed ? "max-h-40 overflow-hidden" : ""}
            style={collapsed ? { maskImage: "linear-gradient(to bottom, black 60%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent)" } : undefined}
          >
            <SafeHtml html={html} className={proseCls} />
          </div>
          {expandable && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 text-sm font-semibold underline underline-offset-4"
              style={{ color: brand }}
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}
    </>
  );
}

type Theme = Database["public"]["Tables"]["clinic_theme"]["Row"];

function BookPage() {
  const { profile, treatments, packages, locations, categories, pricing, theme, reviews, concernAreas, concerns, concernLinks, modelSlots = [], addonLinks = [], practitioners = [], locationPractitioners = [], aboutPage, careGuides = [], pretreatment = [] } =
    Route.useLoaderData() as {
      profile: {
        id: string;
        clinic_name: string;
        full_name: string | null;
        display_name_mode?: string | null;

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
        favourite_treatment_ids?: string[] | null;
        favourites_enabled?: boolean | null;
        favourites_custom_title?: string | null;
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
      aboutPage?: {
        intro_heading?: string | null;
        intro_body?: string | null;
      } | null;
      careGuides?: { id: string; name: string; body_html: string; summary: string | null; category: string | null }[];
      pretreatment?: { id: string; name: string; body_html: string; summary: string | null; sort_order: number; category?: string | null; bullets?: string[] | null }[];

    };


  const { slug } = useParams({ from: "/m/$slug/" });
  const { primary: displayPrimary } = resolveDisplayNames(profile);
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

  // Welcome card settings
  const showLogo = theme?.welcome_card_show_logo ?? true;
  const showName = theme?.welcome_card_show_name ?? true;
  const showTagline = theme?.welcome_card_show_tagline ?? false;
  const showRating = theme?.welcome_card_show_rating ?? true;
  const showActions = theme?.welcome_card_show_actions ?? true;
  const showContact = theme?.welcome_card_show_contact ?? true;
  const showSms = theme?.welcome_card_show_sms ?? true;
  const showWhatsapp = theme?.welcome_card_show_whatsapp ?? true;
  const showInstagram = theme?.welcome_card_show_instagram ?? true;
  const showFacebook = theme?.welcome_card_show_facebook ?? true;
  const cardSize = theme?.welcome_card_size ?? "medium";
  const cardMobileSize = theme?.welcome_card_mobile_size ?? "medium";
  const cardPosition = theme?.welcome_card_position ?? "overlap";
  const cardBgType = theme?.welcome_card_background_type ?? "solid";
  const cardBg = theme?.welcome_card_bg_color ?? bgColor;
  const cardGradientFrom = theme?.welcome_card_gradient_from ?? "#ffffff";
  const cardGradientTo = theme?.welcome_card_gradient_to ?? "#f3f4f6";
  const cardBorder = theme?.welcome_card_border_color ?? `${brand}1a`;
  const cardRadius = theme?.welcome_card_border_radius ?? "1rem";
  const cardBorderWidth = theme?.welcome_card_border_width ?? "1px";
  const cardPadding = theme?.welcome_card_padding ?? "1.25rem";
  const cardShadow = theme?.welcome_card_shadow ?? "0 10px 40px rgba(0,0,0,0.08)";
  const cardOpacity = theme?.welcome_card_opacity ?? 1;
  const cardBlur = theme?.welcome_card_blur ?? 0;

  // Viewport-aware size: wide banner is mobile-only; on desktop it falls back to medium
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const effectiveSize = isMobile ? cardMobileSize : (cardSize === "wide" ? "medium" : cardSize);
  const isCompact = effectiveSize === "compact";
  const isWide = effectiveSize === "wide";
  const introHeading = aboutPage?.intro_heading?.trim() || "";
  const legacyIntroBody = aboutPage?.intro_body?.trim() || "";
  const welcomeHtml = profile.welcome_intro_html?.trim() || (legacyIntroBody ? textToParagraphHtml(legacyIntroBody) : "");
  const introExpandable = Boolean((aboutPage as { intro_expandable?: boolean } | null | undefined)?.intro_expandable);

  const [locationId, setLocationId] = useState<string | null>(null);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [careGuideOpen, setCareGuideOpen] = useState(false);
  const preItems = (pretreatment ?? []).length > 0
    ? (pretreatment ?? []).map((p) => ({ id: p.id, name: p.name, body_html: p.body_html, summary: p.summary, bullets: Array.isArray(p.bullets) ? p.bullets : [] }))
    : (careGuides ?? []).map((g) => ({ id: g.id, name: g.name, body_html: g.body_html, summary: g.summary, bullets: [] as string[] }));
  const hasCareGuides = preItems.length > 0;

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
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const pkgById = useMemo(() => new Map(packages.map((p) => [p.id, p])), [packages]);
  const togglePackageSelect = (id: string) =>
    setSelectedPackageIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const isPackageSelected = (id: string) => selectedPackageIds.includes(id);
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
  const [pickedConcernIds, setPickedConcernIds] = useState<string[]>([]);
  const [concernsConfirmed, setConcernsConfirmed] = useState(false);
  const togglePickedConcern = (id: string) =>
    setPickedConcernIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  void concerns; // referenced via picked ids

  // Clear selection when location changes
  const setLocAndClear = (id: string | null) => {
    setLocationId(id);
    setSelectedIds([]);
    setSelectedPackageIds([]);
    setMode(null);
    setPickedConcernIds([]);
    setConcernsConfirmed(false);
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
  const mappableLocations = locations.filter((l) => mapsUrl(l));
  const firstMapUrl = mappableLocations[0] ? mapsUrl(mappableLocations[0]) : null;


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

  const btnColor = theme?.button_color || brand;
  const btnTextColor = theme?.button_text_color || "#ffffff";
  const btnRadius =
    theme?.button_radius === "rounded-md" ? "0.375rem" :
    theme?.button_radius === "rounded-xl" ? "0.75rem" :
    theme?.button_radius === "pill" ? "9999px" : "0.75rem";
  const btnUppercase = !!theme?.button_uppercase;
  const density = theme?.page_density ?? "cozy";
  const sectionGapPx = density === "compact" ? "1.25rem" : density === "spacious" ? "3rem" : "2rem";
  const pageStyle: React.CSSProperties = {
    backgroundColor: bgColor,
    color: textColor,
    fontFamily: `${bodyFont}, system-ui, sans-serif`,
    ["--brand" as string]: brand,
    ["--brand-accent" as string]: accent,
    ["--btn-color" as string]: btnColor,
    ["--btn-text" as string]: btnTextColor,
    ["--btn-radius" as string]: btnRadius,
    ["--section-gap" as string]: sectionGapPx,
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
      <style>{`
        .modo-btn { background-color: var(--btn-color); color: var(--btn-text); border-radius: var(--btn-radius); ${btnUppercase ? "text-transform: uppercase; letter-spacing: 0.05em;" : ""} }
        [data-modo-section] + [data-modo-section] { margin-top: var(--section-gap); }
      `}</style>

      {/* Hero image / carousel (layout: {layoutKey}) */}
      {(() => {
        const heroHeight = theme?.hero_height ?? "medium";
        const heroOverlayOpacity = theme?.hero_overlay_opacity ?? 0.25;
        const heroOverlayColor = theme?.hero_overlay_color ?? "#000000";
        const heroAlign = theme?.hero_text_alignment ?? "center";
        const heroShowText = theme?.hero_show_text ?? true;
        const heightCls =
          layoutKey === "magazine" ? "h-32 sm:h-40"
          : heroHeight === "short" ? "h-44 w-full object-cover object-top sm:h-56"
          : heroHeight === "tall" ? "h-80 w-full object-cover object-top sm:h-[34rem]"
          : "h-72 w-full object-cover object-top sm:h-[28rem]";
        const splitHeight = heroHeight === "short" ? "h-44 sm:h-64" : heroHeight === "tall" ? "h-72 sm:h-96" : "h-56 sm:h-80";
        const blankHeight = heroHeight === "short" ? "h-40 sm:h-56" : heroHeight === "tall" ? "h-72 sm:h-96" : "h-56 sm:h-72";
        const alignCls = heroAlign === "left" ? "text-left items-start" : heroAlign === "right" ? "text-right items-end" : "text-center items-center";
        return (
          <div className="relative">
            {layoutKey === "magazine" ? (
              heroUrl ? (
                <img src={heroUrl} alt="" className={`w-full object-cover ${heightCls}`} />
              ) : (
                <div className="h-20 w-full" style={{ background: `linear-gradient(135deg, ${brand}, ${accent})` }} />
              )
            ) : carouselEnabled && carouselUrls.length > 0 ? (
              <HeroCarousel urls={carouselUrls} />
            ) : heroUrl ? (
              <img
                src={heroUrl}
                alt=""
                className={layoutKey === "split" ? `${splitHeight} w-full object-cover object-top` : heightCls}
              />
            ) : (
              <div
                className={`${blankHeight} w-full`}
                style={{ background: `linear-gradient(135deg, ${brand}, ${accent})` }}
              />
            )}
            {layoutKey !== "magazine" && heroOverlayOpacity > 0 && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{ backgroundColor: heroOverlayColor, opacity: heroOverlayOpacity }}
              />
            )}
            {layoutKey !== "magazine" && heroShowText && (heroHeading || heroSubheading) && (
              <div className={`absolute inset-x-0 bottom-0 flex flex-col bg-gradient-to-t from-black/60 to-transparent px-4 py-6 sm:py-10 ${alignCls}`}>
                <div className={`mx-auto w-full max-w-3xl text-white ${heroAlign === "center" ? "" : ""}`}>
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
        );
      })()}



      {/* Welcome card */}
      <section
        className={
          isMobile
            ? "relative z-10 mx-auto mt-6 px-4"
            : cardPosition === "below"
              ? "relative z-10 mx-auto mt-6 px-4"
              : isWide
                ? "relative z-10 mx-auto -mt-6 px-4 sm:max-w-2xl sm:-mt-12"
                : layoutKey === "magazine"
                  ? "relative z-10 mx-auto mt-4 px-4"
                  : layoutKey === "split"
                    ? "relative z-10 mx-auto -mt-8 px-4 sm:-mt-12"
                    : "relative z-10 mx-auto -mt-14 px-4 sm:-mt-20"
        }
        style={{ maxWidth: isWide ? "none" : "42rem" }}
      >
        <div
          className={`
            border
            ${isWide ? "w-full" : ""}
            ${isCompact ? "rounded-full px-6 py-3" : ""}
          `}
          style={{
            backgroundColor: cardBgType === "solid" ? cardBg : undefined,
            backgroundImage: cardBgType === "gradient" ? `linear-gradient(135deg, ${cardGradientFrom}, ${cardGradientTo})` : undefined,
            borderColor: cardBorder,
            borderRadius: isCompact ? "9999px" : cardRadius,
            borderWidth: cardBorderWidth,
            padding: isCompact ? "0.75rem 1.25rem" : cardPadding,
            boxShadow: cardShadow,
            opacity: cardOpacity,
            backdropFilter: cardBlur > 0 ? `blur(${cardBlur}px)` : undefined,
            margin: "0 auto",
            maxWidth: isWide ? "none" : isCompact ? "36rem" : "42rem",
          }}
        >
          {isCompact ? (
            <div className="flex flex-wrap items-center gap-2">
              {showLogo && logoUrl && (
                <img src={logoUrl} alt={displayPrimary} className="h-8 w-auto object-contain" />
              )}
              {showName && (
                <h1 className="text-sm font-extrabold leading-tight" style={headingStyle}>{displayPrimary}</h1>
              )}
              <div className="ml-auto flex items-center gap-2">
                {showRating && (
                  <Link to="/m/$slug/reviews" params={{ slug }} className="flex items-center gap-1 hover:opacity-80">
                    {(() => {
                      const count = reviews.length;
                      const avg = count ? reviews.reduce((a, r) => a + r.rating, 0) / count : 0;
                      const rounded = Math.round(avg);
                      return (
                        <>
                          <div className="flex" style={{ color: accent }}>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className="h-3 w-3" fill={count === 0 || i < rounded ? "currentColor" : "none"} />
                            ))}
                          </div>
                          <span className="text-xs opacity-70">{count === 0 ? "New" : `${avg.toFixed(1)}`}</span>
                        </>
                      );
                    })()}
                  </Link>
                )}
                {showSms && profile.contact_sms_number && (
                  <a href={`sms:${profile.contact_sms_number}`} className="rounded-full p-1.5 hover:opacity-80" style={{ backgroundColor: `${brand}14`, color: brand }} aria-label="Text us">
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
                {showWhatsapp && profile.contact_whatsapp_number && (
                  <a href={`https://wa.me/${profile.contact_whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="rounded-full p-1.5 hover:opacity-80" style={{ backgroundColor: `${brand}14`, color: brand }} aria-label="WhatsApp">
                    <MessageCircle className="h-3.5 w-3.5" />
                  </a>
                )}
                {showInstagram && ig && (
                  <a href={ig.startsWith("http") ? ig : "https://instagram.com/" + ig.replace("@", "")} target="_blank" rel="noreferrer" className="rounded-full p-1.5 hover:opacity-80" style={{ backgroundColor: `${brand}14`, color: brand }} aria-label="Instagram">
                    <Instagram className="h-3.5 w-3.5" />
                  </a>
                )}
                {showFacebook && profile.social_links?.facebook && (
                  <a href={profile.social_links.facebook.startsWith("http") ? profile.social_links.facebook : `https://facebook.com/${profile.social_links.facebook}`} target="_blank" rel="noreferrer" className="rounded-full p-1.5 hover:opacity-80" style={{ backgroundColor: `${brand}14`, color: brand }} aria-label="Facebook">
                    <Facebook className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <>
              {showLogo && logoUrl && (
                <img src={logoUrl} alt={displayPrimary} className="mb-2 h-8 w-auto object-contain sm:h-10" />
              )}
              {showName && (
                <h1 className="text-lg font-extrabold leading-tight sm:text-xl" style={headingStyle}>
                  {displayPrimary}
                </h1>
              )}
              {!isCompact && showTagline && profile.tagline && (
                <p className="mt-1 text-sm opacity-70">{profile.tagline}</p>
              )}

              {/* Star rating */}
              {showRating && (
                <Link to="/m/$slug/reviews" params={{ slug }} className="mt-2 flex items-center gap-2 hover:opacity-80">
                  {(() => {
                    const count = reviews.length;
                    const avg = count ? reviews.reduce((a, r) => a + r.rating, 0) / count : 0;
                    const rounded = Math.round(avg);
                    return (
                      <>
                        <div className="flex" style={{ color: accent }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className="h-3.5 w-3.5" fill={count === 0 || i < rounded ? "currentColor" : "none"} />
                          ))}
                        </div>
                        <span className="text-xs opacity-70">
                          {count === 0 ? "Be the first to review" : `${avg.toFixed(1)} · ${count} review${count === 1 ? "" : "s"}`}
                        </span>
                      </>
                    );
                  })()}
                </Link>
              )}


              {/* Action icon row */}
              {!isCompact && showActions && (
                <div className="mt-4 grid grid-cols-4 gap-2 border-t pt-3" style={{ borderColor: `${brand}22` }}>
                  {showInstagram && ig ? (
                    <ActionIcon href={ig.startsWith("http") ? ig : `https://instagram.com/${ig.replace("@", "")}`} label="Instagram" brand={brand}>
                      <Instagram className="h-5 w-5" />
                    </ActionIcon>
                  ) : (
                    <ActionPlaceholder label="Instagram" brand={brand}>
                      <Instagram className="h-5 w-5 opacity-30" />
                    </ActionPlaceholder>
                  )}
                  {mappableLocations.length === 1 && firstMapUrl ? (
                    <ActionIcon href={firstMapUrl} label="Directions" brand={brand}>
                      <MapPin className="h-5 w-5" />
                    </ActionIcon>
                  ) : mappableLocations.length > 1 ? (
                    <ActionButton onClick={() => setDirectionsOpen(true)} label="Directions" brand={brand}>
                      <MapPin className="h-5 w-5" />
                    </ActionButton>
                  ) : (
                    <ActionPlaceholder label="Directions" brand={brand}>
                      <MapPin className="h-5 w-5 opacity-30" />
                    </ActionPlaceholder>
                  )}
                  <ActionButton onClick={handleShare} label="Share" brand={brand}>
                    <Share2 className="h-5 w-5" />
                  </ActionButton>
                  {hasCareGuides ? (
                    <ActionButton onClick={() => setCareGuideOpen(true)} label="Pre-treatment" brand={brand}>
                      <Info className="h-5 w-5" />
                    </ActionButton>
                  ) : (
                    <ActionPlaceholder label="Pre-treatment" brand={brand}>
                      <Info className="h-5 w-5 opacity-30" />
                    </ActionPlaceholder>
                  )}

                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Mobile welcome intro at top */}
      {isMobile && (introHeading || welcomeHtml) && (
        <section id="welcome-intro-mobile" className="mx-auto mt-4 max-w-3xl px-4">
          <div className="rounded-2xl border bg-card px-5 py-5 shadow-sm" style={{ borderColor: `${brand}1a` }}>
            <WelcomeIntroBlock
              heading={introHeading}
              html={welcomeHtml}
              headingStyle={headingStyle}
              brand={brand}
              expandable={introExpandable}
              variant="mobile"
            />
          </div>
        </section>
      )}

      {/* Contact us */}
      {(() => {
        if (!showContact) return null;
        const sms = showSms ? profile.contact_sms_number?.trim() : null;
        const wa = showWhatsapp ? profile.contact_whatsapp_number?.trim() : null;
        const fb = showFacebook ? profile.social_links?.facebook?.trim() : null;
        const igLink = showInstagram ? ig?.trim() : null;
        const items: { href: string; label: string; sub?: string; Icon: typeof Phone }[] = [];
        if (sms) items.push({ href: `sms:${sms}`, label: "Text us", sub: sms, Icon: Phone });
        if (wa) items.push({ href: `https://wa.me/${wa.replace(/[^0-9]/g, "")}`, label: "WhatsApp", sub: wa, Icon: MessageCircle });
        if (igLink) items.push({ href: igLink.startsWith("http") ? igLink : `https://instagram.com/${igLink.replace("@", "")}`, label: "Instagram", sub: igLink, Icon: Instagram });
        if (fb) items.push({ href: fb.startsWith("http") ? fb : `https://facebook.com/${fb}`, label: "Facebook", sub: fb.replace(/^https?:\/\//, ""), Icon: Facebook });
        if (items.length === 0) return null;
        const tileLayout = theme?.contact_tile_layout ?? "grid";
        const tileIconSize = theme?.contact_tile_icon_size ?? "md";
        const tileBg = theme?.contact_tile_bg_color ?? undefined;
        const tileBorder = theme?.contact_tile_border_color ?? `${brand}22`;
        const iconCls = tileIconSize === "sm" ? "h-4 w-4" : tileIconSize === "lg" ? "h-7 w-7" : "h-5 w-5";
        const iconPadCls = tileIconSize === "sm" ? "p-2" : tileIconSize === "lg" ? "p-4" : "p-3";
        const gridCls = tileLayout === "horizontal-list"
          ? "flex flex-col gap-2"
          : "grid grid-cols-2 gap-3 sm:grid-cols-4";
        return (
          <section className="mx-auto mt-8 max-w-3xl px-4">
            <h2 className="mb-4 text-xl font-bold" style={headingStyle}>Get in touch</h2>
            <div className={gridCls}>
              {items.map((it) => (
                <a
                  key={it.label}
                  href={it.href}
                  target={it.href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className={
                    tileLayout === "horizontal-list"
                      ? "flex flex-row items-center gap-3 rounded-2xl border p-3 transition hover:shadow-md"
                      : "flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition hover:shadow-md"
                  }
                  style={{ borderColor: tileBorder, color: textColor, backgroundColor: tileBg ?? "var(--surface, transparent)" }}
                >
                  <span className={`rounded-full ${iconPadCls}`} style={{ backgroundColor: `${brand}14`, color: brand }}>
                    <it.Icon className={iconCls} />
                  </span>
                  <span className="text-sm font-medium">{it.label}</span>
                  {it.sub ? <span className="text-xs opacity-70 truncate w-full">{it.sub}</span> : null}
                </a>
              ))}
            </div>
          </section>
        );

      })()}



      {/* Welcome message */}
      {(introHeading || welcomeHtml) && (
        <section id="welcome-intro" className="mx-auto mt-8 hidden max-w-3xl scroll-mt-24 px-4 sm:block">
          <div
            className="rounded-2xl border bg-card px-5 py-5 shadow-sm sm:px-7 sm:py-6"
            style={{ borderColor: `${brand}1a` }}
          >
            <WelcomeIntroBlock
              heading={introHeading}
              html={welcomeHtml}
              headingStyle={headingStyle}
              brand={brand}
              expandable={introExpandable}
              variant="desktop"
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

      {/* Choose Location + practitioners */}
      {locations.length > 0 && (

        <section data-section="locations" className="mx-auto mt-8 max-w-3xl px-4">
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
      {locationId && chooserOn && mode === "unsure" && !concernsConfirmed && (
        <section className="mx-auto mt-10 max-w-3xl px-4">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => setMode(null)} className="text-sm opacity-70 hover:opacity-100">
              ← Back
            </button>
            <button onClick={() => setMode("know")} className="text-sm font-semibold" style={{ color: brand }}>
              Skip · show full menu
            </button>
          </div>
          <h2 className="mb-2 text-xl font-bold" style={headingStyle}>What are your main concerns?</h2>
          <p className="mb-4 text-sm opacity-70">Select one or more — we'll suggest treatments for all of them.</p>
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
                      {areaConcerns.map((c) => {
                        const picked = pickedConcernIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => togglePickedConcern(c.id)}
                            aria-pressed={picked}
                            className="rounded-xl border bg-card p-3 text-left transition hover:shadow-md"
                            style={{
                              borderColor: picked ? brand : `${brand}33`,
                              borderWidth: picked ? 2 : 1,
                              backgroundColor: picked ? `${brand}0d` : undefined,
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-semibold" style={{ color: brand }}>{c.name}</div>
                              {picked && <Check className="h-4 w-4 shrink-0" style={{ color: brand }} />}
                            </div>
                            {c.description && (
                              <div className="mt-0.5 text-xs opacity-70">{c.description}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="sticky bottom-3 z-10 flex justify-center pt-2">
                <Button
                  disabled={pickedConcernIds.length === 0}
                  onClick={() => setConcernsConfirmed(true)}
                  className="rounded-full px-6 py-2 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: brand }}
                >
                  Continue{pickedConcernIds.length > 0 ? ` · ${pickedConcernIds.length} selected` : ""}
                </Button>
              </div>
            </div>
          )}
          {showConsult && (
            <div className="mt-6 rounded-2xl border-2 border-dashed p-5 text-center" style={{ borderColor: `${brand}55` }}>
              <p className="text-sm font-semibold" style={{ color: brand }}>Still not sure?</p>
              <p className="mt-1 text-xs opacity-70">Book a consultation and we'll talk through all your concerns together.</p>
              {consultTreatmentId ? (
                <Link
                  to="/m/$slug/book/$treatmentId"
                  params={{ slug, treatmentId: consultTreatmentId }}
                  className="mt-3 inline-block rounded-full px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: brand }}
                >
                  Book a consultation
                </Link>
              ) : (
                <button
                  onClick={() => { setMode("know"); setPickedConcernIds([]); setConcernsConfirmed(false); }}
                  className="mt-3 inline-block rounded-full px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  style={{ backgroundColor: brand }}
                >
                  Browse consultations
                </button>
              )}
            </div>
          )}
        </section>
      )}


      {/* Favourite / Most popular treatments */}
      {(() => {
        if (!locationId) return null;
        if (profile.favourites_enabled === false) return null;
        const favIds = (profile.favourite_treatment_ids ?? []) as string[];
        if (!favIds.length) return null;
        const favs = favIds
          .map((id) => treatments.find((t) => t.id === id))
          .filter((t): t is Treatment => !!t && t.active !== false);
        if (!favs.length) return null;
        const multiPract = practitioners.length > 1;
        const ownerName = displayPrimary;
        const possessive = ownerName.endsWith("s") ? `${ownerName}'` : `${ownerName}'s`;
        const heading = profile.favourites_custom_title?.trim() || `${possessive} Favourite Treatments`;
        const scroll = (dir: number) => {
          const el = document.getElementById("fav-carousel");
          if (!el) return;
          el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
        };
        return (
          <section className="mx-auto mt-10 max-w-5xl px-4">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 className="text-xl font-bold sm:text-2xl" style={headingStyle}>{heading}</h2>
              {favs.length > 1 && (
                <div className="hidden gap-2 sm:flex">
                  <button onClick={() => scroll(-1)} aria-label="Previous" className="grid h-9 w-9 place-items-center rounded-full border bg-card transition hover:shadow" style={{ borderColor: `${brand}33` }}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => scroll(1)} aria-label="Next" className="grid h-9 w-9 place-items-center rounded-full border bg-card transition hover:shadow" style={{ borderColor: `${brand}33` }}>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <div
              id="fav-carousel"
              className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {favs.map((t) => {
                const img = (t as Treatment & { picture_url?: string | null }).picture_url;
                const sessions = formatTreatmentSessions(t);
                return (
                  <Link
                    key={t.id}
                    to="/m/$slug/book/$treatmentId"
                    params={{ slug, treatmentId: t.id }}
                    className="group flex w-[78%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md sm:w-[calc((100%-2rem)/3)]"
                    style={{ borderColor: `${brand}1f`, backgroundColor: menuCardBg }}
                  >
                    {img && (
                      <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                        <img src={img} alt={t.name} className="h-full w-full object-cover transition group-hover:scale-[1.03]" loading="lazy" />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-1 p-4">
                      <div className="text-base font-semibold sm:text-lg" style={{ color: menuNameColor }}>{t.name}</div>
                      {sessions && (
                        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: brand }}>
                          {sessions}
                        </div>
                      )}
                      {t.description && <div className="line-clamp-2 text-sm opacity-70">{t.description}</div>}
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="opacity-70">{durationFor(t)} min</span>
                        <span className="font-semibold" style={{ color: menuPriceColor }}>{formatPrice(priceFor(t), (t as any).price_mode)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })()}


      {/* Treatments + Packages */}

      {locationId && (!chooserOn || mode === "know" || (mode === "unsure" && concernsConfirmed && pickedConcernIds.length > 0)) ? (
        <section className="mx-auto mt-10 max-w-3xl px-4 pb-32">
          {chooserOn && (
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => {
                  if (mode === "unsure" && concernsConfirmed) setConcernsConfirmed(false);
                  else setMode(null);
                }}
                className="text-sm opacity-70 hover:opacity-100"
              >
                ← Back
              </button>
              {mode === "unsure" && concernsConfirmed && (
                <button onClick={() => { setMode("know"); setPickedConcernIds([]); setConcernsConfirmed(false); }} className="text-sm font-semibold" style={{ color: brand }}>
                  Show full menu
                </button>
              )}
            </div>
          )}
          {(() => {
            // If on concern path, filter to matched treatments (union across all picked concerns)
            const onConcernPath = mode === "unsure" && concernsConfirmed && pickedConcernIds.length > 0;
            const matchedIds = onConcernPath
              ? new Set(
                  concernLinks
                    .filter((l) => pickedConcernIds.includes(l.concern_id))
                    .map((l) => l.treatment_id),
                )
              : null;
            const filteredTreatments = matchedIds
              ? visibleTreatments.filter((t) => matchedIds.has(t.id))
              : visibleTreatments;
            const tree = matchedIds ? buildTree(categories, filteredTreatments) : { roots, uncategorised };

            if (matchedIds) {
              const concernNames = pickedConcernIds
                .map((id) => concerns.find((c) => c.id === id)?.name)
                .filter((n): n is string => !!n);
              return (
                <>
                  {concernNames.length > 0 && (
                    <h2 className="mb-3 text-lg font-bold" style={headingStyle}>
                      Suggested for: {concernNames.join(", ")}
                    </h2>
                  )}
                  {filteredTreatments.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-6 text-center text-sm opacity-70" style={{ borderColor: `${brand}33` }}>
                      No treatments matched to {concernNames.length > 1 ? "these concerns" : "this concern"} yet.
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
                <TabsList className="grid w-full grid-cols-2 h-auto" style={{ backgroundColor: `${brand}10` }}>
                  <TabsTrigger value="treatments" className="text-sm sm:text-base py-2.5">Treatments</TabsTrigger>
                  <TabsTrigger value="packages" disabled={packages.length === 0} className="text-sm sm:text-base py-2.5">
                    <PackageIcon className="mr-1.5 h-4 w-4" />
                    Packages
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="treatments" className="mt-4">
                  <p className="mb-3 text-sm opacity-70">
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
                        const includedTreatments = ids
                          .map((tid) => treatments.find((t) => t.id === tid))
                          .filter((t): t is Treatment => Boolean(t));
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
                              {includedTreatments.length > 0 && (
                                <div className="mt-3 rounded-lg border p-2.5" style={{ borderColor: `${brand}26`, background: `${brand}0a` }}>
                                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                                    Includes
                                  </div>
                                  <ul className="space-y-0.5 text-sm">
                                    {includedTreatments.map((t) => (
                                      <li key={t.id} className="flex items-start gap-1.5">
                                        <span style={{ color: brand }}>•</span>
                                        <span>{t.name}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {(() => {
                                const originalTotal = includedTreatments.reduce((s, t) => s + Number(t.price ?? 0), 0) * (p.session_count || 1);
                                const price = Number(p.price ?? 0);
                                const saving = originalTotal > price ? originalTotal - price : 0;
                                const savingPct = originalTotal > 0 && saving > 0 ? Math.round((saving / originalTotal) * 100) : 0;
                                return saving > 0 ? (
                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                      Save £{saving.toFixed(2)} ({savingPct}%)
                                    </span>
                                    <span className="text-xs opacity-60 line-through">£{originalTotal.toFixed(2)}</span>
                                  </div>
                                ) : null;
                              })()}
                              <div className="mt-3 flex items-center justify-between gap-2">
                                <p className="font-bold" style={{ color: brand }}>
                                  £{Number(p.price ?? 0).toFixed(2)}
                                </p>
                                {firstTreatmentId ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => togglePackageSelect(p.id)}
                                      aria-pressed={isPackageSelected(p.id)}
                                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                                      style={
                                        isPackageSelected(p.id)
                                          ? { backgroundColor: brand, borderColor: brand, color: "#fff" }
                                          : { borderColor: `${brand}66`, color: brand }
                                      }
                                    >
                                      {isPackageSelected(p.id) ? (<><Check className="h-3 w-3" /> Added</>) : "Add"}
                                    </button>
                                    <Link
                                      to="/m/$slug/book/$treatmentId"
                                      params={{ slug, treatmentId: firstTreatmentId }}
                                      className="modo-btn px-4 py-1.5 text-sm font-semibold"
                                    >
                                      Book
                                    </Link>
                                  </div>
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
      {locationId && (selectedIds.length > 0 || selectedPackageIds.length > 0) && (() => {
        const treatmentsTotal = selectedIds
          .map((id) => priceFor(treatments.find((t) => t.id === id)!))
          .reduce((a, b) => a + b, 0);
        const packagesTotal = selectedPackageIds
          .map((pid) => Number(pkgById.get(pid)?.price ?? 0))
          .reduce((a, b) => a + b, 0);
        const total = treatmentsTotal + packagesTotal;
        const parts: string[] = [];
        if (selectedIds.length) parts.push(`${selectedIds.length} treatment${selectedIds.length === 1 ? "" : "s"}`);
        if (selectedPackageIds.length) parts.push(`${selectedPackageIds.length} package${selectedPackageIds.length === 1 ? "" : "s"}`);
        return (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur" style={{ borderColor: `${brand}33` }}>
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-semibold" style={{ color: brand }}>
                  {parts.join(" + ")} selected
                </div>
                <div className="text-xs opacity-70">Total £{total.toFixed(2)}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setSelectedIds([]); setSelectedPackageIds([]); }}>
                  Clear
                </Button>
                <Link
                  to="/m/$slug/book-multi"
                  params={{ slug }}
                  search={{
                    ids: selectedIds.join(","),
                    pkgs: selectedPackageIds.join(","),
                  }}
                >
                  <Button size="sm" style={{ backgroundColor: brand, color: "#fff" }}>
                    Continue →
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        );
      })()}



      {/* Footer */}
      <footer
        className="mt-16 w-full px-4 py-6 text-center text-xs"
        style={{ backgroundColor: footerBg, color: footerText }}
      >
        © {new Date().getFullYear()} {displayPrimary} · Powered by MODO
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

      {/* Pre-treatment info */}
      <Dialog open={careGuideOpen} onOpenChange={setCareGuideOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" style={{ borderColor: `${brand}33` }}>
          <DialogHeader>
            <DialogTitle style={{ color: brand }}>Pre-treatment information</DialogTitle>
            <DialogDescription>Important things to know and prepare before your appointment.</DialogDescription>
          </DialogHeader>
          {preItems.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No pre-treatment notes have been published yet.</p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {preItems.map((g) => (
                <AccordionItem key={g.id} value={g.id}>
                  <AccordionTrigger className="text-left">
                    <span className="flex flex-col">
                      <span className="font-semibold">{g.name}</span>
                      {g.summary && <span className="text-xs font-normal text-muted-foreground">{g.summary}</span>}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    {g.bullets && g.bullets.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-1.5 text-sm leading-relaxed">
                        {g.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    ) : (
                      <SafeHtml
                        html={g.body_html || ""}
                        className="prose prose-sm max-w-none [&_p]:leading-relaxed [&_strong]:font-bold"
                      />
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </DialogContent>
      </Dialog>


      {/* Directions location picker */}
      <Dialog open={directionsOpen} onOpenChange={setDirectionsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" style={{ borderColor: `${brand}33` }}>
          <DialogHeader>
            <DialogTitle style={{ color: brand }}>Choose a location</DialogTitle>
            <DialogDescription>Select the clinic you want directions to.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {mappableLocations.map((loc) => {
              const url = mapsUrl(loc);
              const photo = loc.image_url || profile.avatar_url;
              return (
                <a
                  key={loc.id}
                  href={url || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setDirectionsOpen(false)}
                  className="flex items-center gap-3 rounded-xl border p-3 transition hover:bg-muted"
                  style={{ borderColor: `${brand}22`, backgroundColor: menuCardBg }}
                >
                  {photo ? (
                    <img src={photo} alt={loc.name} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white" style={{ backgroundColor: brand }}>
                      {loc.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold" style={{ color: brand }}>
                      {loc.name}
                      {loc.is_primary && <Star className="ml-1 inline h-3 w-3" fill="currentColor" />}
                    </div>
                    {formatAddress(loc) && (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{formatAddress(loc)}</div>
                    )}
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 opacity-60" />
                </a>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

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
    (n) =>
      n.treatments.length > 0 ||
      n.children.some((c) => countTreatments(c) > 0),
  );
  if (visible.length === 0) return null;

  return (
    <div className={depth === 0 ? "space-y-4" : "space-y-3"}>
      {visible.map((node) => {
        const isSub = depth > 0;
        const isComingSoon = !!node.coming_soon_at && new Date(node.coming_soon_at) > new Date();
        const comingLabel = isComingSoon
          ? new Date(node.coming_soon_at!).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
          : "";
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
                    className={`leading-tight ${isSub ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"} ${categoryBold ? "font-extrabold" : "font-medium"} flex items-center gap-2 flex-wrap`}
                  >
                    <span>
                      {node.icon ? `${node.icon} ` : ""}
                      {node.name}
                    </span>
                    {isComingSoon && (
                      <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900 shadow-sm">
                        Book from {comingLabel}
                      </span>
                    )}
                  </div>
                  {node.description && (
                    <div className="mt-1 text-sm font-normal opacity-80">{node.description}</div>
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
  const picture = (t as Treatment & { picture_url?: string | null }).picture_url || null;
  const hasMore = isLong || !!picture;

  const padding = size === "lg" ? "p-4 sm:p-5" : size === "md" ? "p-4" : "p-3.5";
  const nameSize = size === "lg" ? "text-lg sm:text-xl" : size === "md" ? "text-base sm:text-lg" : "text-[15px] sm:text-base";
  const priceSize = size === "lg" ? "text-lg" : size === "md" ? "text-base" : "text-[15px]";
  const checkSize = size === "lg" ? "h-6 w-6" : "h-5 w-5";
  const thumbSize = size === "lg" ? "h-16 w-16 sm:h-20 sm:w-20" : "h-14 w-14 sm:h-16 sm:w-16";

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
      <button type="button" onClick={() => setExpanded((v) => !v)} className="min-w-0 flex-1 text-left">
        {picture && (
          <div className={`float-right ml-3 overflow-hidden rounded-lg bg-muted ${thumbSize} ${expanded ? "hidden" : ""}`}>
            <img src={picture} alt={t.name} className="h-full w-full object-cover" loading="lazy" />
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className={`min-w-0 flex-1 leading-tight ${nameSize} ${bold ? "font-bold" : "font-medium"}`} style={{ color: nameColor }}>
            {t.name}
            {(() => {
              const b = (t as any).badge as TreatmentBadge | null | undefined;
              if (!b) return null;
              return (
                <span
                  className={`ml-2 align-middle inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClasses(b)}`}
                >
                  {BADGE_LABEL[b]}
                </span>
              );
            })()}
          </div>
          {(() => {
            const mode = ((t as any).price_mode ?? "fixed") as "fixed" | "from" | "poa" | "free";
            const pct = (t as any).discount_percent as number | null;
            const startsAt = (t as any).discount_starts_at as string | null;
            const endsAt = (t as any).discount_ends_at as string | null;
            const dows = (t as any).discount_days_of_week as number[] | null;
            const now = new Date();
            const inWindow = (!startsAt || new Date(startsAt) <= now)
              && (!endsAt || new Date(endsAt) >= now)
              && (!dows || dows.length === 0 || dows.includes(now.getDay()));
            const allowDiscount = mode !== "poa" && mode !== "free";
            const hasDisc = allowDiscount && pct != null && pct > 0 && inWindow && price > 0;
            const discounted = hasDisc ? price * (1 - pct / 100) : price;
            return (
              <div className={`flex flex-col items-end leading-tight ${priceSize} ${bold ? "font-bold" : "font-semibold"}`} style={{ color: priceColor }}>
                {hasDisc && ((t as any).discount_show_was_now !== false) && (
                  <span className="text-xs font-normal text-muted-foreground line-through">{formatPrice(price, mode)}</span>
                )}
                <span className="whitespace-nowrap">{formatPrice(discounted, mode)}</span>
                {hasDisc && (
                  <span className="mt-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">−{pct}%</span>
                )}
              </div>
            );
          })()}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>{duration} min</span>

          {((t as { session_count?: number }).session_count ?? 1) > 1 && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: `${brand}1a`, color: brand }}
            >
              {formatTreatmentSessions(t)}
            </span>
          )}
          {(t as { allow_split_payment?: boolean }).allow_split_payment && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              Split payment available
            </span>
          )}
        </div>

        {expanded && picture && (
          <div className="mt-3 overflow-hidden rounded-lg bg-muted">
            <img src={picture} alt={t.name} className="max-h-72 w-full object-cover" loading="lazy" />
          </div>
        )}
        {desc && (
          <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {shown}
          </div>
        )}
        {hasMore && (
          <div className="mt-1.5 text-sm font-semibold" style={{ color: brand }}>
            {expanded ? "Show less" : picture && !isLong ? "View photo" : "Read more"}
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={selected ? "Deselect" : "Select"}
        className="sr-only"
      />
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
