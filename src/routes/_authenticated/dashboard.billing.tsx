import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyBilling,
  startBillingCheckout,
  openStripePortal,
  redeemDiscountCode,
  cancelMySubscription,
  resumeMySubscription,
} from "@/lib/practitioner-billing.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/billing")({
  ssr: false,
  component: BillingPage,
});

function money(cents: number, currency = "gbp") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function BillingPage() {
  const fetchBilling = useServerFn(getMyBilling);
  const startCheckout = useServerFn(startBillingCheckout);
  const openPortal = useServerFn(openStripePortal);
  const redeem = useServerFn(redeemDiscountCode);
  const cancel = useServerFn(cancelMySubscription);
  const resume = useServerFn(resumeMySubscription);

  const [state, setState] = useState<Awaited<ReturnType<typeof getMyBilling>> | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [extraLocations, setExtraLocations] = useState(0);
  const [extraPractitioners, setExtraPractitioners] = useState(0);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const d = await fetchBilling();
      setState(d);
      if (!selectedPlanId && d.plans.length > 0) {
        const base = d.plans.find((p: any) => p.kind === "base");
        if (base) setSelectedPlanId(base.id);
      }
      if (d.subscription) {
        setExtraLocations(d.subscription.extra_locations ?? 0);
        setExtraPractitioners(d.subscription.extra_practitioners ?? 0);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load billing");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!state) return null;

  const sub = state.subscription as any;
  const basePlans = (state.plans as any[]).filter((p: any) => p.kind === "base" || !p.kind);
  const locAddon = (state.plans as any[]).find((p: any) => p.kind === "addon_location");
  const pracAddon = (state.plans as any[]).find((p: any) => p.kind === "addon_practitioner");
  const selectedPlan = basePlans.find((p: any) => p.id === selectedPlanId);
  const discountCode = state.discountCode as any;

  const trialActive = sub?.trial_end && new Date(sub.trial_end as string) > new Date();
  const trialDaysLeft = trialActive ? Math.max(0, Math.ceil((new Date(sub.trial_end as string).getTime() - Date.now()) / 86400000)) : 0;

  const projected =
    (selectedPlan?.amount_cents ?? 0) +
    extraLocations * (locAddon?.amount_cents ?? 0) +
    extraPractitioners * (pracAddon?.amount_cents ?? 0);

  async function checkout() {
    if (!selectedPlanId) return;
    setBusy(true);
    try {
      const res = await startCheckout({
        data: {
          basePlanId: selectedPlanId,
          extraLocations, extraPractitioners,
          successUrl: window.location.origin + "/dashboard/billing?ok=1",
          cancelUrl: window.location.origin + "/dashboard/billing",
        },
      });
      if (res.url) window.location.href = res.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally { setBusy(false); }
  }

  async function portal() {
    setBusy(true);
    try {
      const res = await openPortal({ data: { returnUrl: window.location.href } });
      if (res.url) window.location.href = res.url;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Portal failed"); }
    finally { setBusy(false); }
  }

  async function apply() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const res = await redeem({ data: { code } });
      if (res.ok) { toast.success(`Applied ${res.code}`); setCode(""); reload(); }
      else toast.error(res.message);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not redeem"); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plan & billing</h1>
        <p className="text-muted-foreground">Your MODO subscription, add-ons and payment history.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current status
            {sub?.comped ? <Badge>Comp</Badge>
              : trialActive ? <Badge variant="secondary">Trial — {trialDaysLeft}d left</Badge>
              : sub?.status === "active" ? <Badge>Active</Badge>
              : sub?.suspended_at ? <Badge variant="destructive">Suspended</Badge>
              : <Badge variant="outline">{sub?.status ?? "none"}</Badge>}
          </CardTitle>
          <CardDescription>
            {sub?.subscription_plans?.name
              ? <>Plan: <strong>{sub.subscription_plans.name}</strong> — {money(sub.custom_price_cents ?? sub.subscription_plans.amount_cents, sub.subscription_plans.currency)}/{sub.subscription_plans.interval}</>
              : "No active plan"}
          </CardDescription>
        </CardHeader>
        {sub?.stripe_customer_id && (
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={portal} disabled={busy}>Manage in Stripe</Button>
            {sub.cancel_at_period_end
              ? <Button variant="outline" onClick={() => resume().then(reload)} disabled={busy}>Resume</Button>
              : sub.status === "active" && <Button variant="outline" onClick={() => cancel().then(reload)} disabled={busy}>Cancel at period end</Button>}
          </CardContent>
        )}
      </Card>

      {(!sub || sub.status !== "active" || !sub.stripe_subscription_id) && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a plan</CardTitle>
            <CardDescription>You can change or cancel any time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {basePlans.map((p: any) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`rounded-lg border p-4 text-left transition ${selectedPlanId === p.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}
                >
                  <div className="font-semibold">{p.name}</div>
                  {p.description && <div className="text-xs text-muted-foreground mt-1">{p.description}</div>}
                  <div className="mt-2 text-lg font-bold">{money(p.amount_cents, p.currency)}<span className="text-sm font-normal text-muted-foreground">/{p.interval}</span></div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {locAddon && (
                <div className="rounded-lg border p-3">
                  <div className="font-medium text-sm">Extra locations</div>
                  <div className="text-xs text-muted-foreground">{money(locAddon.amount_cents, locAddon.currency)}/{locAddon.interval} each</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => setExtraLocations(Math.max(0, extraLocations - 1))}><Minus className="h-4 w-4" /></Button>
                    <span className="w-8 text-center">{extraLocations}</span>
                    <Button size="icon" variant="outline" onClick={() => setExtraLocations(extraLocations + 1)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
              {pracAddon && (
                <div className="rounded-lg border p-3">
                  <div className="font-medium text-sm">Extra practitioners</div>
                  <div className="text-xs text-muted-foreground">{money(pracAddon.amount_cents, pracAddon.currency)}/{pracAddon.interval} each</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={() => setExtraPractitioners(Math.max(0, extraPractitioners - 1))}><Minus className="h-4 w-4" /></Button>
                    <span className="w-8 text-center">{extraPractitioners}</span>
                    <Button size="icon" variant="outline" onClick={() => setExtraPractitioners(extraPractitioners + 1)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-md bg-muted p-3 text-sm">
              Estimated total: <strong>{money(projected)}</strong>/{selectedPlan?.interval ?? "month"}
              {trialActive && <span className="text-muted-foreground"> — starts after your trial ({trialDaysLeft} days remaining)</span>}
            </div>

            <Button onClick={checkout} disabled={busy || !selectedPlanId} className="w-full sm:w-auto">
              {sub?.stripe_customer_id ? "Update subscription" : "Start subscription"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Discount code</CardTitle>
          <CardDescription>
            {discountCode
              ? <>Applied: <strong>{discountCode.code}</strong>{discountCode.percent_off ? ` — ${discountCode.percent_off}% off` : discountCode.amount_off_cents ? ` — ${money(discountCode.amount_off_cents)} off` : ""}</>
              : "Have a promo code? Redeem it here."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2 items-end">
          <div className="flex-1">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MODO2026" />
          </div>
          <Button onClick={apply} disabled={busy || !code.trim()}>Apply</Button>
        </CardContent>
      </Card>
    </div>
  );
}
