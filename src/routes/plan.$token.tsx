import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, ClipboardCheck, Sparkles, Clock, HeartPulse, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getPlanByToken, respondToPlanByToken } from "@/lib/treatment-plans.functions";

export const Route = createFileRoute("/plan/$token")({
  ssr: false,
  component: PlanTokenPage,
  head: () => ({
    meta: [
      { title: "Your treatment plan" },
      { name: "description", content: "Review your personalised treatment plan and accept or request changes." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

const DECLINE_TAGS = [
  { value: "request_changes", label: "Request changes" },
  { value: "more_info", label: "Need more information" },
  { value: "pricing", label: "Concerns about pricing" },
  { value: "timing", label: "Timing doesn't work" },
  { value: "not_interested", label: "Not interested right now" },
];

function PlanTokenPage() {
  const { token } = useParams({ from: "/plan/$token" });
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineTags, setDeclineTags] = useState<string[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await getPlanByToken({ data: { token } });
      setState(res);
    } catch (e: any) {
      toast.error(e.message || "Could not load plan");
      setState(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [token]);

  const accept = async () => {
    setBusy(true);
    try {
      const r: any = await respondToPlanByToken({ data: { token, accept: true } });
      if (!r?.ok) throw new Error(r?.error || "Could not accept plan");
      toast.success("Plan accepted");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      const r: any = await respondToPlanByToken({ data: {
        token,
        accept: false,
        reason: declineReason.trim() || null,
        tags: declineTags.length ? declineTags : null,
      } });
      if (!r?.ok) throw new Error(r?.error || "Could not decline plan");
      toast.success("Feedback sent to your practitioner");
      setDeclineOpen(false);
      setDeclineReason("");
      setDeclineTags([]);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!state || !state.plan) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Plan not available</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This treatment plan link is no longer valid. Please contact your practitioner.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { plan, clinic, sessions, client } = state;
  const brand = clinic?.brand_color || "#0f172a";
  const pricing = computePricing(plan, sessions);
  const canRespond = plan.status === "sent" || plan.status === "declined";

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          {clinic?.logo_url && (
            <img src={clinic.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
          )}
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{clinic?.clinic_name}</div>
            <h1 className="text-2xl font-semibold" style={{ color: brand }}>{plan.name}</h1>
            {client?.full_name && <div className="text-sm text-muted-foreground">Prepared for {client.full_name}</div>}
          </div>
        </div>

        {plan.description && (
          <Card><CardContent className="pt-6 text-sm">{plan.description}</CardContent></Card>
        )}

        {/* Status */}
        <div className="flex items-center gap-2">
          <Badge variant={
            plan.status === "accepted" || plan.status === "in_progress" || plan.status === "completed" ? "default" :
            plan.status === "declined" || plan.status === "cancelled" ? "destructive" : "secondary"
          }>{prettyStatus(plan.status)}</Badge>
          {plan.status === "declined" && plan.decline_reason && (
            <span className="text-xs text-muted-foreground">Your feedback has been sent</span>
          )}
        </div>

        {/* Pricing summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Investment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoneyCents(pricing.subtotal)}</span></div>
            {pricing.discount > 0 && (
              <div className="flex justify-between text-emerald-700"><span>Discount</span><span>−{formatMoneyCents(pricing.discount)}</span></div>
            )}
            <div className="flex justify-between font-semibold text-base pt-1 border-t"><span>Total</span><span style={{ color: brand }}>{formatMoneyCents(pricing.grandTotal)}</span></div>
            <div className="text-xs text-muted-foreground pt-1">{paymentModeLabel(plan.payment_mode)}{plan.deposit_cents ? ` · Deposit ${formatMoneyCents(plan.deposit_cents)}` : ""}</div>
          </CardContent>
        </Card>

        {/* Sessions */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Your sessions</h2>
          {(sessions || []).map((s: any) => {
            const price = s.price_cents_override != null
              ? s.price_cents_override
              : s.treatment?.price != null ? Math.round(s.treatment.price * 100) : 0;
            return (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Session {s.session_number}
                        {s.session_number > 1 && s.interval_weeks_from_previous ? ` · +${s.interval_weeks_from_previous} weeks after previous` : ""}
                      </div>
                      <CardTitle className="text-base">{s.treatment?.name ?? "Session"}</CardTitle>
                    </div>
                    <div className="text-right">
                      <div className="font-medium" style={{ color: brand }}>{formatMoneyCents(price)}</div>
                      {s.treatment?.duration && <div className="text-xs text-muted-foreground">{s.treatment.duration} min</div>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {s.session_purpose && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide"><Sparkles className="h-3 w-3" /> What this session does</div>
                      <p className="mt-1">{s.session_purpose}</p>
                    </div>
                  )}
                  {s.expected_results && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide"><CheckCircle2 className="h-3 w-3" /> Expected results</div>
                      <p className="mt-1">{s.expected_results}</p>
                    </div>
                  )}
                  {s.downtime && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide"><HeartPulse className="h-3 w-3" /> Downtime &amp; aftercare</div>
                      <p className="mt-1">{s.downtime}</p>
                    </div>
                  )}
                  {s.notes && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</div>
                      <p className="mt-1">{s.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Actions */}
        {canRespond ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm mb-3">Happy with the plan? Accept it to let your practitioner know. If anything's not quite right, let them know what to change.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="lg" onClick={accept} disabled={busy} style={{ backgroundColor: brand }}>
                  <ClipboardCheck className="h-4 w-4 mr-2" /> Accept plan
                </Button>
                <Button size="lg" variant="outline" onClick={() => setDeclineOpen(true)} disabled={busy}>
                  <XCircle className="h-4 w-4 mr-2" /> Decline / request changes
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : plan.status === "accepted" || plan.status === "in_progress" ? (
          <Card><CardContent className="pt-6 flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> You've accepted this plan. Your practitioner will be in touch to book your next session.
          </CardContent></Card>
        ) : null}

        <p className="text-xs text-muted-foreground text-center pt-4">Sent by {clinic?.clinic_name}. Prices are indicative and may vary at your appointment.</p>
      </div>

      {/* Decline dialog */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Let your practitioner know</DialogTitle>
            <DialogDescription>They'll receive your feedback and can revise the plan or reach out.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>What's the reason? (optional)</Label>
              <div className="grid grid-cols-1 gap-2">
                {DECLINE_TAGS.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={declineTags.includes(t.value)}
                      onCheckedChange={(v) => setDeclineTags((prev) => v ? [...prev, t.value] : prev.filter((x) => x !== t.value))}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Tell them more (optional)</Label>
              <Textarea rows={4} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="What would you like to change, or what more info do you need?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeclineOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={decline} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Send feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function computePricing(plan: any, sessions: any[]) {
  const subtotalCents = (sessions || []).reduce((sum, s) => {
    if (s.price_cents_override != null) return sum + Number(s.price_cents_override);
    if (typeof s.treatment?.price === "number") return sum + Math.round(s.treatment.price * 100);
    return sum;
  }, 0);
  const base = plan.course_price_cents != null ? Number(plan.course_price_cents) : subtotalCents;
  let discount = 0;
  if (plan.discount_percent) discount = Math.round(base * (Number(plan.discount_percent) / 100));
  else if (plan.discount_cents) discount = Math.min(base, Number(plan.discount_cents));
  return { subtotal: base, discount, grandTotal: Math.max(0, base - discount) };
}

function formatMoneyCents(v: number) {
  return `£${((v || 0) / 100).toFixed(2)}`;
}

function paymentModeLabel(m: string) {
  if (m === "course_upfront") return "Pay in full upfront";
  if (m === "deposit_then_per_session") return "Deposit now, pay per session";
  return "Pay per session";
}

function prettyStatus(s: string) {
  if (s === "in_progress") return "In progress";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
