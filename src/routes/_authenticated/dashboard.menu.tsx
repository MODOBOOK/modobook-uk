import { membershipsEnabled, pilotFeaturesEnabled, practitionerReferralsEnabled, smsMarketingEnabled } from "@/lib/feature-flags";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  LogOut,
  ExternalLink,
  Search,
  Gift,
  HelpCircle,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { amIAdmin } from "@/lib/admin.functions";
import { ComingSoonDialog, type ComingSoonKey } from "@/components/ComingSoonDialog";
import { canAccessRoute, type ClinicRole } from "@/lib/staff-nav";
import { getComingSoonKey, menuGroups, type MenuItem } from "@/lib/menu-groups";

export const Route = createFileRoute("/_authenticated/dashboard/menu")({
  ssr: false,
  loader: async () => {
    try { return await amIAdmin(); } catch { return { admin: false }; }
  },
  component: MenuPage,
});


function MenuPage() {
  const { profile } = Route.useRouteContext() as {
    profile: {
      slug: string;
      clinic_name?: string | null;
      associates_enabled?: boolean | null;
      __clinic_role?: ClinicRole;
    };
  };
  const clinicRole: ClinicRole = profile.__clinic_role ?? "owner";
  const { admin } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [comingSoon, setComingSoon] = useState<ComingSoonKey | null>(null);


  const pilot = pilotFeaturesEnabled(profile.slug);

  const comingSoonFor = (to: string) => getComingSoonKey(to, pilot);

  const memberships = membershipsEnabled(profile.slug);
  const smsMarketing = smsMarketingEnabled(profile.slug);

  const visible = useMemo(() => {
    return menuGroups.map((g) => ({
      ...g,
      items: g.items
        .filter((i) => canAccessRoute(clinicRole, i.to, { canManageRota: Boolean((profile as Record<string, unknown>)?.["__can_manage_rota"]), canUsePrescribing: Boolean((profile as Record<string, unknown>)?.["__can_use_prescribing"]) }))
        .filter((i) => (i.to === "/dashboard/compliance" ? pilot && (profile as { compliance_enabled?: boolean | null }).compliance_enabled !== false && (profile as { plan_tier?: string | null }).plan_tier !== "solo" : true))
        .filter((i) => (i.to === "/dashboard/memberships" ? memberships : true))
        .filter((i) => (i.to === "/dashboard/marketing/sms" ? smsMarketing : true))
        .filter((i) =>
          i.to === "/dashboard/associates"
            ? pilot
              ? !!profile.associates_enabled
              : true // non-pilot clinics see it as "coming soon"
            : true,
        ),
    })).filter((g) => g.items.length > 0);
  }, [profile.associates_enabled, pilot, clinicRole, memberships, smsMarketing]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return visible.flatMap((g) =>
      g.items
        .filter((i) => i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
        .map((i) => ({ ...i, group: g.title })),
    );
  }, [query, visible]);

  const openGroup = visible.find((g) => g.title === activeGroup) ?? null;

  const renderItem = (item: MenuItem, groupTitle?: string) => {
    const soon = comingSoonFor(item.to);
    const inner = (
      <div className="flex items-center gap-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ring-1 ring-black/5 ${item.tone}`}>
          <item.icon className={`h-6 w-6 ${item.iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-base font-semibold leading-tight">
            {item.label}
            {soon && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-primary">
                Soon
              </span>
            )}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {groupTitle ? `${groupTitle} · ` : ""}{item.description}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
      </div>
    );
    return soon ? (
      <button
        key={item.to}
        type="button"
        onClick={() => setComingSoon(soon)}
        className="group block w-full rounded-2xl border border-primary/20 bg-card p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-primary/40 active:scale-[0.99]"
      >
        {inner}
      </button>
    ) : (
      <Link
        key={item.to}
        to={item.to}
        className="group block rounded-2xl border border-muted-foreground/10 bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-primary/30 hover:shadow-md active:scale-[0.99]"
      >
        {inner}
      </Link>
    );
  };

  // Sub-menu screen — slides in when a category is tapped.
  if (openGroup && !searchResults) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-1 animate-in slide-in-from-right-6 fade-in duration-200">
        <button
          type="button"
          onClick={() => setActiveGroup(null)}
          className="mt-1 flex items-center gap-1.5 rounded-full border border-muted-foreground/15 bg-card px-4 py-2 text-sm font-semibold shadow-sm transition active:scale-[0.98]"
        >
          <ChevronLeft className="h-4 w-4" /> Menu
        </button>
        <div className="flex items-center gap-4 px-1">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-1 ring-black/5">
            <openGroup.icon className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{openGroup.title}</h1>
            <p className="text-xs text-muted-foreground">{openGroup.blurb}</p>
          </div>
        </div>
        <div className="space-y-3">
          {openGroup.items.map((item) => renderItem(item))}
        </div>
        <ComingSoonDialog
          open={comingSoon !== null}
          onOpenChange={(v) => !v && setComingSoon(null)}
          feature={comingSoon ?? "general"}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-1">
      <div className="pt-2 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">My Clinic</h1>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What are you looking for?"
          className="h-12 rounded-full border-muted-foreground/20 pl-11 pr-4 shadow-sm"
        />
      </div>

      {searchResults ? (
        <div className="space-y-3">
          {searchResults.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing matches “{query}”.</p>
          )}
          {searchResults.map((item) => renderItem(item, item.group))}
        </div>
      ) : (
        <>
          <Card className="overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Your booking link</p>
                <p className="mt-0.5 truncate text-sm font-semibold">/m/{profile.slug}</p>
              </div>
              <Button size="sm" asChild className="rounded-full">
                <a href={`/m/${profile.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-4 w-4" /> Open
                </a>
              </Button>
            </CardContent>
          </Card>

          {practitionerReferralsEnabled(profile.slug) && (
            <Link
              to="/dashboard/partner-referrals"
              className="block overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/60 p-5 text-primary-foreground shadow-md transition active:scale-[0.99]"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30">
                  <Gift className="h-7 w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-extrabold leading-tight">Give &amp; get back</p>
                  <p className="mt-0.5 text-xs leading-snug text-primary-foreground/90">
                    Refer a fellow practitioner to MODO — they get 25% off for 3 months, you earn 50% off a month for every referral.
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0" />
              </div>
            </Link>
          )}

          <div className="space-y-3">
            {visible.map((g) => {
              const soonCount = g.items.filter((i) => comingSoonFor(i.to)).length;
              return (
                <button
                  key={g.title}
                  type="button"
                  onClick={() => setActiveGroup(g.title)}
                  className="group block w-full rounded-2xl border border-muted-foreground/10 bg-card p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-primary/30 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ring-1 ring-black/5 sm:h-14 sm:w-14">
                      <g.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-2 text-base font-semibold leading-tight">
                        <span className="truncate">{g.title}</span>
                        {soonCount > 0 && (
                          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-primary">
                            {soonCount} soon
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{g.blurb}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {g.items.length}
                      </span>
                      <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {admin && (
            <Link to="/admin" className="block rounded-2xl border border-muted-foreground/10 bg-card p-4 shadow-sm transition active:scale-[0.99]">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ring-1 ring-black/5">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold leading-tight">Platform admin</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">Practitioners, admins & invites</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </div>
            </Link>
          )}

          <Link
            to="/dashboard/help"
            className="block rounded-2xl border border-muted-foreground/10 bg-card p-4 shadow-sm transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-black/5">
                <HelpCircle className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold leading-tight">Help &amp; FAQ</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">Guides &amp; answers for running your clinic</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </div>
          </Link>

          <a
            href="https://wa.me/447385790119"
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white ring-1 ring-black/5">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold leading-tight">WhatsApp support</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">Message the MODO team — +44 7385 790119</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </div>
          </a>

          <Button
            variant="outline"
            size="lg"
            className="w-full rounded-full"
            onClick={() => supabase.auth.signOut({ scope: "local" })}
          >
            <LogOut className="mr-2 h-4 w-4" /> Log out
          </Button>
          <div className="h-4" />
        </>
      )}
      <ComingSoonDialog
        open={comingSoon !== null}
        onOpenChange={(v) => !v && setComingSoon(null)}
        feature={comingSoon ?? "general"}
      />
    </div>
  );
}
