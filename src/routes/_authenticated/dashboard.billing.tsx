import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyBilling,
  getMyInvoices,
  startBillingCheckout,
  openStripePortal,
  redeemDiscountCode,
  cancelMySubscription,
  resumeMySubscription,
  saveAddonSelection,
  updateMySubscriptionItems,
} from "@/lib/practitioner-billing.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Minus, Plus, MapPin, Users, FileText, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/billing")({
  ssr: false,
  component: BillingPage,
});

function money(cents: number, currency = "gbp") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function BillingPage() {
  const fetchBilling = useServerFn(getMyBilling);
  const fetchInvoices = useServerFn(getMyInvoices);
  const startCheckout = useServerFn(startBillingCheckout);
  const openPortal = useServerFn(openStripePortal);
  const redeem = useServerFn(redeemDiscountCode);
  const cancel = useServerFn(cancelMySubscription);
  const resume = useServerFn(resumeMySubscription);
  const saveAddons = useServerFn(saveAddonSelection);
  const updateItems = useServerFn(updateMySubscriptionItems);

  const [state, setState] = useState<Awaited<ReturnType<typeof getMyBilling>> | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [extraLocations, setExtraLocations] = useState(0);
  const [extraPractitioners, setExtraPractitioners] = useState(0);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [d, inv] = await Promise.all([fetchBilling(), fetchInvoices().catch(() => [])]);
      setState(d);
      setInvoices(inv as any[]);
      if (!selectedPlanId && d.plans.length > 0) {
        const currentPlanId = (d.subscription as any)?.plan_id;
        const base = (currentPlanId && d.plans.find((p: any) => p.id === currentPlanId))
          || d.plans.find((p: any) => p.kind === "base");
        if (base) setSelectedPlanId(base.id);
      }
      // The plan price is collated from the account itself: chargeable seats are
      // whatever exists beyond the one included (plus any comped extras).
      const freeLocs = Math.max(0, (d.subscription as any)?.free_locations ?? 0);
      const freePracs = Math.max(0, (d.subscription as any)?.free_practitioners ?? 0);
      const usedExtraLocs = Math.max(0, (d.usage?.locations ?? 0) - 1 - freeLocs);
      const usedExtraPracs = Math.max(0, (d.usage?.practitioners ?? 0) - 1 - freePracs);
      const savedLocs = d.subscription?.extra_locations ?? 0;
      const savedPracs = d.subscription?.extra_practitioners ?? 0;
      const nextLocs = Math.max(savedLocs, usedExtraLocs);
      const nextPracs = Math.max(savedPracs, usedExtraPracs);
      setExtraLocations(nextLocs);
      setExtraPractitioners(nextPracs);

      // If the actual usage is above the saved selection, persist that so
      // checkout reflects the reserved seats.
      if (nextLocs !== savedLocs || nextPracs !== savedPracs) {
        dirtyRef.current = true;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load billing");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  // Persist add-on selection during trial so it pre-fills at checkout.
  const dirtyRef = useRef(false);
  useEffect(() => {
    if (loading || !selectedPlanId) return;
    if (!dirtyRef.current) return;
    const t = setTimeout(() => {
      saveAddons({ data: { basePlanId: selectedPlanId, extraLocations, extraPractitioners } }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [selectedPlanId, extraLocations, extraPractitioners, loading]);
  function bump<T>(setter: (v: T) => void, v: T) { dirtyRef.current = true; setter(v); }

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

  const hasLiveSub = !!sub?.stripe_subscription_id && sub?.status !== "canceled";

  // Seats already in use can't be removed here — delete the location or
  // practitioner instead and the plan re-collates automatically.
  const freeLocs = Math.max(0, sub?.free_locations ?? 0);
  const freePracs = Math.max(0, sub?.free_practitioners ?? 0);
  const usedLocations = state.usage?.locations ?? 0;
  const usedPractitioners = state.usage?.practitioners ?? 0;
  const minLocations = Math.max(0, usedLocations - 1 - freeLocs);
  const minPractitioners = Math.max(0, usedPractitioners - 1 - freePracs);
  const nextBilling = sub?.current_period_end
    ? new Date(sub.current_period_end as string).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;


  async function checkoutOrUpdate() {
    if (!selectedPlanId) return;
    setBusy(true);
    try {
      if (hasLiveSub) {
        await updateItems({ data: { basePlanId: selectedPlanId, extraLocations, extraPractitioners } });
        toast.success("Subscription updated — the change will appear on your next direct-debit invoice.");
        reload();
      } else {
        const res = await startCheckout({
          data: {
            basePlanId: selectedPlanId,
            extraLocations, extraPractitioners,
            successUrl: window.location.origin + "/dashboard/billing?ok=1",
            cancelUrl: window.location.origin + "/dashboard/billing",
          },
        });
        if (res.url) window.location.href = res.url;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
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

      <Card>
        <CardHeader>
          <CardTitle>{hasLiveSub ? "Edit your plan" : "Choose a plan"}</CardTitle>
          <CardDescription>
            {hasLiveSub
              ? "Change your plan or add-ons at any time. Updates are added to your existing direct debit on the next invoice — no need to re-enter card details."
              : "You can change or cancel any time."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {basePlans.map((p: any) => (
              <button
                key={p.id}
                type="button"
                onClick={() => bump(setSelectedPlanId, p.id)}
                className={`rounded-lg border p-4 text-left transition ${selectedPlanId === p.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.name}</span>
                  {sub?.plan_id === p.id && <Badge variant="secondary" className="text-[10px]">Current</Badge>}
                </div>
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
                  <Button size="icon" variant="outline" disabled={extraLocations <= minLocations} onClick={() => bump(setExtraLocations, Math.max(minLocations, extraLocations - 1))}><Minus className="h-4 w-4" /></Button>
                  <span className="w-8 text-center">{extraLocations}</span>
                  <Button size="icon" variant="outline" onClick={() => bump(setExtraLocations, extraLocations + 1)}><Plus className="h-4 w-4" /></Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <Link to="/dashboard/locations" className="underline underline-offset-2">
                    {usedLocations} location{usedLocations === 1 ? "" : "s"} on your account
                  </Link>
                  {minLocations > 0 ? ` — ${minLocations} charged` : " — all included"}
                </p>
                {minLocations > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Counted automatically. Remove a location to reduce this.
                  </p>
                )}
              </div>
            )}
            {pracAddon && (
              <div className="rounded-lg border p-3">
                <div className="font-medium text-sm">Extra practitioners</div>
                <div className="text-xs text-muted-foreground">{money(pracAddon.amount_cents, pracAddon.currency)}/{pracAddon.interval} each</div>
                <div className="mt-2 flex items-center gap-2">
                  <Button size="icon" variant="outline" disabled={extraPractitioners <= minPractitioners} onClick={() => bump(setExtraPractitioners, Math.max(minPractitioners, extraPractitioners - 1))}><Minus className="h-4 w-4" /></Button>
                  <span className="w-8 text-center">{extraPractitioners}</span>
                  <Button size="icon" variant="outline" onClick={() => bump(setExtraPractitioners, extraPractitioners + 1)}><Plus className="h-4 w-4" /></Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <Link to="/dashboard/practitioners" className="underline underline-offset-2">
                    {usedPractitioners} practitioner{usedPractitioners === 1 ? "" : "s"} on your account
                  </Link>
                  {minPractitioners > 0 ? ` — ${minPractitioners} charged` : " — all included"}
                </p>
                {minPractitioners > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Counted automatically. Remove a practitioner to reduce this.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span>{selectedPlan?.name ?? "Base plan"}</span>
              <span>{money(selectedPlan?.amount_cents ?? 0)}</span>
            </div>
            {locAddon && extraLocations > 0 && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{extraLocations} × extra location</span>
                <span>{money(extraLocations * locAddon.amount_cents)}</span>
              </div>
            )}
            {pracAddon && extraPractitioners > 0 && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{extraPractitioners} × extra practitioner</span>
                <span>{money(extraPractitioners * pracAddon.amount_cents)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-1 font-semibold">
              <span>{hasLiveSub ? "New total" : "Estimated total"}</span>
              <span>{money(projected)}/{selectedPlan?.interval ?? "month"}</span>
            </div>
            {hasLiveSub && (
              <p className="pt-1 text-xs text-muted-foreground">
                Nothing is charged today — your direct debit updates and collects the new amount from your next
                billing date{nextBilling ? ` (${nextBilling})` : ""}.
              </p>
            )}
            {!hasLiveSub && trialActive && (
              <p className="pt-1 text-xs text-muted-foreground">
                Saved and pre-filled when you set up the direct debit after your {trialDaysLeft}-day trial.
              </p>
            )}
          </div>


          <Button onClick={checkoutOrUpdate} disabled={busy || !selectedPlanId} className="w-full sm:w-auto">
            {hasLiveSub ? "Save changes" : trialActive ? "Set up direct debit (Stripe)" : "Start subscription"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Invoices</CardTitle>
          <CardDescription>Every direct-debit charge and any amount currently owed to MODO.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <p className="p-4 text-sm italic text-muted-foreground">No invoices yet. They'll appear here as soon as your first billing cycle runs.</p>
          ) : (
            <div className="divide-y">
              {invoices.map((inv: any) => {
                const status = inv.status as string;
                const badge = status === "paid" ? "default"
                  : status === "open" || status === "past_due" || status === "uncollectible" ? "destructive"
                  : "secondary";
                const label = status === "paid" ? "Paid"
                  : status === "open" ? "Owed"
                  : status === "past_due" ? "Past due"
                  : status === "uncollectible" ? "Failed"
                  : status;
                return (
                  <div key={inv.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{money(inv.amount_due_cents ?? inv.amount_total_cents ?? 0, inv.currency ?? "gbp")}</div>
                      <div className="text-xs text-muted-foreground">
                        {inv.number ? `#${inv.number} · ` : ""}{new Date(inv.created_at).toLocaleDateString()}
                        {inv.amount_remaining_cents > 0 ? ` · Owed: ${money(inv.amount_remaining_cents, inv.currency ?? "gbp")}` : ""}
                      </div>
                    </div>
                    <Badge variant={badge as any}>{label}</Badge>
                    {inv.hosted_invoice_url && (
                      <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline">
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
