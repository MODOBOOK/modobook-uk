import { createFileRoute, Link, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listPublicMembershipPlans,
  getMyMembershipForClinic,
  subscribeToMembershipPlan,
} from "@/lib/memberships.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crown, Wallet, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { membershipsEnabled } from "@/lib/feature-flags";

export const Route = createFileRoute("/m/$slug/memberships")({
  head: () => ({
    meta: [
      { title: "Memberships" },
      { name: "description", content: "Join a membership plan — a monthly savings pot of treatment credit, member pricing and perks." },
    ],
  }),
  component: MembershipsPublicPage,
});

type IncludedTreatment = { treatment_id: string; quantity: number; name: string; price_cents: number | null };

type PublicPlan = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  interval: "month" | "year";
  credit_cents: number;
  spend_mode: "any" | "restricted" | "manual";
  discount_percent: number | null;
  perks: string | null;
  included_treatments: Array<{ treatment_id: string; quantity: number }> | unknown;
  includedTreatmentDetails?: IncludedTreatment[];
  terms_text?: string | null;
  terms_checkboxes?: Array<{ label: string; required?: boolean }> | null;
};

const gbp = (cents: number) => `£${(cents / 100).toFixed(2)}`;

function MembershipsPublicPage() {
  const { slug } = useParams({ from: "/m/$slug/memberships" });

  // Memberships are pilot-only: clinics outside the pilot get no public page.
  if (!membershipsEnabled(slug)) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Crown className="mx-auto h-10 w-10 opacity-40" />
        <h1 className="mt-4 text-xl font-semibold">Page not available</h1>
        <p className="mt-2 text-sm opacity-70">This clinic doesn't offer memberships yet.</p>
      </div>
    );
  }

  return <MembershipsPublicInner slug={slug} />;
}

function MembershipsPublicInner({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const fetchPlans = useServerFn(listPublicMembershipPlans);
  const fetchMine = useServerFn(getMyMembershipForClinic);
  const subscribe = useServerFn(subscribeToMembershipPlan);
  const search = useSearch({ strict: false }) as { joined?: string };
  const [sessionUser, setSessionUser] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [termsPlan, setTermsPlan] = useState<PublicPlan | null>(null);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessionUser(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSessionUser(s?.user.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const plansQ = useQuery({
    queryKey: ["public-membership-plans", slug],
    queryFn: () => fetchPlans({ data: { slug } }),
  });
  const mineQ = useQuery({
    queryKey: ["my-membership", slug],
    queryFn: () => fetchMine({ data: { slug } }),
    enabled: !!sessionUser,
  });

  useEffect(() => {
    if (search?.joined === "1") {
      toast.success("Welcome aboard! Your membership is active.");
      qc.invalidateQueries({ queryKey: ["my-membership", slug] });
    }
  }, [search?.joined, qc, slug]);

  const plans = (plansQ.data?.plans ?? []) as unknown as PublicPlan[];
  const clinicName = plansQ.data?.clinicName ?? "this clinic";
  const mine = mineQ.data;

  const myPlanIds = useMemo(
    () =>
      new Set(
        ((mine?.memberships ?? []) as Array<{ status: string; membership_plans?: { name: string } | null; id: string }>)
          .filter((m) => m.status === "active" || m.status === "paused")
          .map((m) => m.id),
      ),
    [mine],
  );
  const activePlanNames = useMemo(() => {
    const set = new Set<string>();
    for (const m of (mine?.memberships ?? []) as Array<{ status: string; membership_plans?: { name: string } | null }>) {
      if ((m.status === "active" || m.status === "paused") && m.membership_plans?.name) set.add(m.membership_plans.name);
    }
    return set;
  }, [mine]);

  function handleJoin(planId: string) {
    if (!sessionUser) {
      window.location.href = `/m/${slug}/auth?next=${encodeURIComponent(`/m/${slug}/memberships`)}`;
      return;
    }
    const plan = plans.find((p) => p.id === planId) ?? null;
    const boxes = plan?.terms_checkboxes ?? [];
    if (plan && (plan.terms_text?.trim() || boxes.length)) {
      setTicked({});
      setTermsPlan(plan);
      return;
    }
    void startCheckout(planId, []);
  }

  async function startCheckout(planId: string, acceptedCheckboxes: string[]) {
    setJoiningId(planId);
    try {
      const res = await subscribe({ data: { slug, planId, acceptedCheckboxes } });
      if (res.url) window.location.href = res.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
      setJoiningId(null);
    }
  }

  const brand = "var(--brand, hsl(var(--primary)))";

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:pt-10">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-3xl px-6 py-10 sm:px-10 sm:py-14"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklab, ${brand} 92%, black 8%), color-mix(in oklab, ${brand} 55%, white 45%))`,
          color: "white",
        }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, white, transparent 70%)" }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] backdrop-blur">
            <Crown className="h-3.5 w-3.5" /> Membership
          </span>
          <h1
            className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl"
            style={{ fontFamily: "var(--heading-font, inherit)" }}
          >
            Look after your skin, every month
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
            Join a plan with {clinicName}. Pay monthly by card, build a savings pot of treatment credit and enjoy member
            pricing and perks.
          </p>
        </div>
      </section>

      {/* Savings pot */}
      {sessionUser && mine && (
        <div className="mt-5 flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: `color-mix(in oklab, ${brand} 14%, transparent)`, color: brand }}
            >
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] opacity-60">Your savings pot</div>
              <div className="text-3xl font-semibold tabular-nums">{gbp(mine.balanceCents)}</div>
            </div>
          </div>
          <div className="text-sm opacity-70">
            {mine.memberships.length === 0
              ? "No active membership yet."
              : `${(mine.memberships as Array<{ status: string }>).filter((m) => m.status === "active").length} active membership(s)`}
          </div>
        </div>
      )}

      {/* Plans */}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {plansQ.isLoading && (
          <div className="h-56 animate-pulse rounded-2xl bg-muted sm:col-span-2" aria-label="Loading plans" />
        )}
        {!plansQ.isLoading && plans.length === 0 && (
          <Card className="sm:col-span-2">
            <CardContent className="py-14 text-center text-sm opacity-70">
              {clinicName} doesn't have any membership plans on sale right now.
            </CardContent>
          </Card>
        )}
        {plans.map((p) => {
          const joined = activePlanNames.has(p.name);
          const perks = (p.perks ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
          const included = p.includedTreatmentDetails ?? [];
          const per = p.interval === "year" ? "year" : "month";
          const includedValue = included.reduce((s, t) => s + (t.price_cents ?? 0) * t.quantity, 0);
          return (
            <Card
              key={p.id}
              className="flex flex-col overflow-hidden rounded-2xl border-2 transition-shadow hover:shadow-lg"
              style={joined ? { borderColor: brand } : undefined}
            >
              {/* Plan header */}
              <div
                className="px-6 pb-5 pt-6"
                style={{ background: `color-mix(in oklab, ${brand} 7%, transparent)` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2
                    className="text-xl font-semibold leading-tight"
                    style={{ fontFamily: "var(--heading-font, inherit)" }}
                  >
                    {p.name}
                  </h2>
                  {joined && (
                    <Badge style={{ background: brand, color: "white" }} className="shrink-0 border-0">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Member
                    </Badge>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tabular-nums" style={{ color: brand }}>
                    {gbp(p.price_cents)}
                  </span>
                  <span className="text-sm opacity-60">/{per}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.credit_cents > 0 && (
                    <Badge variant="secondary" className="gap-1 rounded-full font-normal">
                      <Sparkles className="h-3 w-3" /> {gbp(p.credit_cents)} credit each {per}
                    </Badge>
                  )}
                  {p.discount_percent ? (
                    <Badge variant="secondary" className="rounded-full font-normal">
                      {p.discount_percent}% off bookings
                    </Badge>
                  ) : null}
                </div>
              </div>

              <CardContent className="flex flex-1 flex-col gap-5 px-6 py-6">
                {p.description && <p className="text-sm leading-relaxed opacity-80">{p.description}</p>}

                {included.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-medium uppercase tracking-[0.16em] opacity-60">
                        Treatments included
                      </span>
                      {includedValue > 0 && (
                        <span className="text-[11px] opacity-60">worth {gbp(includedValue)}</span>
                      )}
                    </div>
                    <ul className="space-y-2">
                      {included.map((t) => (
                        <li
                          key={t.treatment_id}
                          className="flex items-center gap-3 rounded-xl border bg-background/60 px-3 py-2.5"
                        >
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
                            style={{ background: `color-mix(in oklab, ${brand} 14%, transparent)`, color: brand }}
                          >
                            {t.quantity}×
                          </span>
                          <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{t.name}</span>
                          {t.price_cents != null && t.price_cents > 0 && (
                            <span className="shrink-0 text-xs tabular-nums opacity-55 line-through">
                              {gbp(t.price_cents * t.quantity)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs opacity-60">Included every {per}.</p>
                  </div>
                )}

                {perks.length > 0 && (
                  <ul className="space-y-2 text-sm">
                    {perks.map((perk, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: brand }} /> {perk}
                      </li>
                    ))}
                  </ul>
                )}

                <p className="text-xs leading-relaxed opacity-60">
                  Credit can be spent on{" "}
                  {p.spend_mode === "any"
                    ? "any booking"
                    : p.spend_mode === "restricted"
                      ? "selected treatments"
                      : "treatments in clinic (the team applies it for you)"}
                  .
                </p>

                <Button
                  className="mt-auto h-12 w-full rounded-xl text-base"
                  style={{ background: brand, color: "white" }}
                  disabled={joiningId === p.id}
                  onClick={() => handleJoin(p.id)}
                >
                  {joiningId === p.id
                    ? "Opening checkout…"
                    : joined
                      ? "Manage / rejoin"
                      : sessionUser
                        ? `Join for ${gbp(p.price_cents)}/${p.interval === "year" ? "yr" : "mo"}`
                        : "Sign in to join"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="mx-auto mt-8 max-w-md text-center text-xs leading-relaxed opacity-55">
        Payments are handled securely by the clinic's card provider. You can ask the clinic to pause or cancel your
        membership at any time.
      </p>
      <div className="mt-4 text-center">
        <Link to="/m/$slug" params={{ slug }} className="text-sm underline opacity-70 hover:opacity-100">
          ← Back to bookings
        </Link>
      </div>

      {/* Terms & conditions before joining */}
      <Dialog open={!!termsPlan} onOpenChange={(o) => !o && setTermsPlan(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{termsPlan?.name} — terms &amp; conditions</DialogTitle>
          </DialogHeader>
          {termsPlan?.terms_text?.trim() ? (
            <div className="max-h-56 overflow-y-auto rounded-xl bg-muted/50 p-4 text-sm leading-relaxed whitespace-pre-line">
              {termsPlan.terms_text}
            </div>
          ) : null}
          <div className="space-y-3">
            {(termsPlan?.terms_checkboxes ?? []).map((b, i) => (
              <label key={i} className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
                <Checkbox
                  className="mt-0.5"
                  checked={!!ticked[b.label]}
                  onCheckedChange={(v) => setTicked((t) => ({ ...t, [b.label]: !!v }))}
                />
                <span>{b.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs opacity-60">
            We'll email you a copy of these terms and record your agreement with {clinicName}.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTermsPlan(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                !!joiningId ||
                (termsPlan?.terms_checkboxes ?? []).some((b) => b.required !== false && !ticked[b.label])
              }
              onClick={() => {
                if (!termsPlan) return;
                const accepted = (termsPlan.terms_checkboxes ?? [])
                  .filter((b) => ticked[b.label])
                  .map((b) => b.label);
                const id = termsPlan.id;
                setTermsPlan(null);
                void startCheckout(id, accepted);
              }}
            >
              Agree &amp; continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
