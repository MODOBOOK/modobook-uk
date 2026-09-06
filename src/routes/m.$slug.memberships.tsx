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
import { Crown, Wallet, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/m/$slug/memberships")({
  head: () => ({
    meta: [
      { title: "Memberships" },
      { name: "description", content: "Join a membership plan — a monthly savings pot of treatment credit, member pricing and perks." },
    ],
  }),
  component: MembershipsPublicPage,
});

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
};

const gbp = (cents: number) => `£${(cents / 100).toFixed(2)}`;

function MembershipsPublicPage() {
  const { slug } = useParams({ from: "/m/$slug/memberships" });
  const qc = useQueryClient();
  const fetchPlans = useServerFn(listPublicMembershipPlans);
  const fetchMine = useServerFn(getMyMembershipForClinic);
  const subscribe = useServerFn(subscribeToMembershipPlan);
  const search = useSearch({ strict: false }) as { joined?: string };
  const [sessionUser, setSessionUser] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

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

  async function handleJoin(planId: string) {
    if (!sessionUser) {
      window.location.href = `/m/${slug}/auth?next=${encodeURIComponent(`/m/${slug}/memberships`)}`;
      return;
    }
    setJoiningId(planId);
    try {
      const res = await subscribe({ data: { slug, planId } });
      if (res.url) window.location.href = res.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
      setJoiningId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold" style={{ fontFamily: "var(--heading-font, inherit)" }}>
          <Crown className="h-7 w-7" /> Memberships
        </h1>
        <p className="mt-1 text-sm opacity-80">
          Join a plan with {clinicName} — pay monthly by card and build a savings pot of treatment credit, with member
          pricing and perks.
        </p>
      </div>

      {sessionUser && mine && (
        <Card>
          <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="h-8 w-8 opacity-70" />
              <div>
                <div className="text-xs uppercase tracking-wide opacity-70">Your savings pot</div>
                <div className="text-2xl font-bold">{gbp(mine.balanceCents)}</div>
              </div>
            </div>
            <div className="text-sm opacity-80">
              {mine.memberships.length === 0
                ? "No active membership yet."
                : `${(mine.memberships as Array<{ status: string }>).filter((m) => m.status === "active").length} active membership(s)`}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {plansQ.isLoading && <p className="text-sm opacity-70">Loading plans…</p>}
        {!plansQ.isLoading && plans.length === 0 && (
          <Card><CardContent className="py-12 text-center text-sm opacity-70">
            {clinicName} doesn't have any membership plans on sale right now.
          </CardContent></Card>
        )}
        {plans.map((p) => {
          const joined = activePlanNames.has(p.name);
          const perks = (p.perks ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
          const included = Array.isArray(p.included_treatments) ? p.included_treatments : [];
          return (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="space-y-3 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold">{p.name}</span>
                  <Badge variant="outline">{gbp(p.price_cents)}/{p.interval === "year" ? "year" : "month"}</Badge>
                  {p.credit_cents > 0 && (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      <Sparkles className="mr-1 h-3 w-3" /> {gbp(p.credit_cents)} credit each {p.interval === "year" ? "year" : "month"}
                    </Badge>
                  )}
                  {p.discount_percent ? <Badge variant="outline">{p.discount_percent}% off bookings</Badge> : null}
                  {joined && <Badge><CheckCircle2 className="mr-1 h-3 w-3" /> You're a member</Badge>}
                </div>
                {p.description && <p className="text-sm opacity-80">{p.description}</p>}
                <p className="text-xs opacity-70">
                  Credit can be spent on{" "}
                  {p.spend_mode === "any"
                    ? "any booking"
                    : p.spend_mode === "restricted"
                      ? "selected treatments"
                      : "treatments in clinic (the team applies it for you)"}
                  {included.length > 0 && ` · includes ${(included as Array<{ quantity: number }>).reduce((s, t) => s + t.quantity, 0)} treatment(s) per cycle`}.
                </p>
                {perks.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {perks.map((perk, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 opacity-70" /> {perk}
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  className="w-full sm:w-auto"
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

      <p className="text-center text-xs opacity-60">
        Payments are handled securely by the clinic's card provider. You can ask the clinic to pause or cancel your
        membership at any time.
      </p>
      <div className="text-center">
        <Link to="/m/$slug" params={{ slug }} className="text-sm underline opacity-70 hover:opacity-100">
          ← Back to bookings
        </Link>
      </div>
    </div>
  );
}
