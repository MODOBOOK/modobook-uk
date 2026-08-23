import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Send, Copy, CheckCircle2, ClipboardList, Sparkles, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import {
  listPlansForClient,
  createPlanForClient,
  updatePlan,
  sendPlan,
  deletePlan,
  suggestPlanForClient,
  suggestPlanSession,
} from "@/lib/treatment-plans.functions";
import { supabase } from "@/integrations/supabase/client";
import { TreatmentPicker } from "@/components/TreatmentPicker";

type Treatment = { id: string; name: string; price: number | null; duration: number | null; category_id?: string | null };
type Category = { id: string; name: string };

export function TreatmentPlansPanel({
  clientId,
  consultationId,
  profileId,
}: {
  clientId: string;
  consultationId?: string | null;
  profileId?: string;
}) {
  const list = useServerFn(listPlansForClient);
  const create = useServerFn(createPlanForClient);
  const update = useServerFn(updatePlan);
  const send = useServerFn(sendPlan);
  const del = useServerFn(deletePlan);
  const suggest = useServerFn(suggestPlanForClient);

  const [plans, setPlans] = useState<any[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const p = await list({ data: { clientId } });
      setPlans(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    (async () => {
      const { data } = await supabase
        .from("treatments")
        .select("id,name,price,duration,category_id")
        .eq("active", true)
        .order("name");
      setTreatments((data || []) as Treatment[]);
      const { data: cats } = await supabase
        .from("treatment_categories")
        .select("id,name")
        .order("sort_order", { ascending: true });
      setCategories((cats || []) as Category[]);
    })();
  }, [clientId]);

  const openEditor = async (planId: string) => {
    const fresh = await list({ data: { clientId } });
    setPlans(fresh);
    const found = fresh.find((p: any) => p.id === planId);
    if (found) setEditing(found);
  };

  const handleCreateBlank = async () => {
    try {
      const plan = await create({
        data: {
          clientId,
          consultationId: consultationId ?? null,
          name: newName || undefined,
        },
      });
      toast.success("Plan created — tailor it to the patient");
      setNewOpen(false);
      setNewName("");
      await openEditor(plan.id);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAiSuggest = async () => {
    setSuggesting(true);
    try {
      const plan = await suggest({
        data: {
          clientId,
          consultationId: consultationId ?? null,
          extraContext: aiContext || null,
        },
      });
      toast.success("AI drafted a plan — review and edit before sending");
      setNewOpen(false);
      setAiContext("");
      setNewName("");
      await openEditor(plan.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSuggesting(false);
    }
  };

  const handleSend = async (id: string) => {
    try {
      await send({ data: { id } });
      toast.success("Plan sent to patient");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this plan?")) return;
    try {
      await del({ data: { id } });
      toast.success("Deleted");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4" />
          Treatment plans
        </CardTitle>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New plan
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : plans.length === 0 ? (
          <div className="text-sm text-muted-foreground">No treatment plans yet.</div>
        ) : (
          plans.map((p) => {
            const completed = (p.sessions || []).filter((s: any) => s.status === "completed").length;
            const total = (p.sessions || []).length;
            const { subtotal, discount, grandTotal } = computePlanPricing(p);
            return (
              <div key={p.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {total} session{total === 1 ? "" : "s"} · {p.booking_mode === "upfront" ? "Book upfront" : "Rolling booking"} · {paymentModeLabel(p.payment_mode)}
                    </div>
                  </div>
                  <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">Total {formatMoney(grandTotal)}</span>
                  {discount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      <span className="line-through">{formatMoney(subtotal)}</span> · {formatMoney(discount)} off
                    </span>
                  )}
                </div>
                {total > 0 && (
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
                    />
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {completed} of {total} completed
                </div>
                {p.status === "declined" && (p.decline_reason || (p.decline_tags && p.decline_tags.length > 0)) && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs space-y-1">
                    <div className="font-medium text-destructive">Patient feedback</div>
                    {p.decline_tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.decline_tags.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-[10px]">{tag.replace(/_/g, " ")}</Badge>
                        ))}
                      </div>
                    )}
                    {p.decline_reason && <div className="text-foreground/80">{p.decline_reason}</div>}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                  {p.status === "draft" && (
                    <Button size="sm" onClick={() => handleSend(p.id)}>
                      <Send className="h-3 w-3 mr-1" /> Send to patient
                    </Button>
                  )}
                  {p.status !== "draft" && p.patient_token && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/plan/${p.patient_token}`);
                        toast.success("Link copied");
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy patient link
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })

        )}
      </CardContent>

      {/* New plan dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New treatment plan</DialogTitle>
            <DialogDescription>Every plan is tailored to this patient's concerns. Let AI draft one from their consultation & concerns, or build from scratch.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Plan name (optional)</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Skin rejuvenation course" />
            </div>
            <div>
              <Label>Extra context for AI (optional)</Label>
              <Textarea
                value={aiContext}
                onChange={(e) => setAiContext(e.target.value)}
                rows={3}
                placeholder="e.g. Prefers minimal downtime; budget-conscious; wants results before wedding in 3 months"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={suggesting}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleCreateBlank} disabled={suggesting}>
              Build from scratch
            </Button>
            <Button onClick={handleAiSuggest} disabled={suggesting}>
              {suggesting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              AI suggest plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Edit plan */}
      {editing && (
        <EditPlanDialog
          plan={editing}
          clientId={clientId}
          treatments={treatments}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </Card>
  );
}

function EditPlanDialog({
  plan,
  clientId,
  treatments,
  categories,
  onClose,
  onSaved,
}: {
  plan: any;
  clientId: string;
  treatments: Treatment[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const update = useServerFn(updatePlan);
  const aiSession = useServerFn(suggestPlanSession);
  const [aiBusyIdx, setAiBusyIdx] = useState<number | null>(null);
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? "");
  const [bookingMode, setBookingMode] = useState(plan.booking_mode);
  const [paymentMode, setPaymentMode] = useState(plan.payment_mode);
  const [coursePrice, setCoursePrice] = useState(plan.course_price_cents ? String(plan.course_price_cents / 100) : "");
  const [deposit, setDeposit] = useState(plan.deposit_cents ? String(plan.deposit_cents / 100) : "");
  const [discountType, setDiscountType] = useState<"none" | "percent" | "fixed">(
    plan.discount_percent ? "percent" : plan.discount_cents ? "fixed" : "none",
  );
  const [discountPercent, setDiscountPercent] = useState(plan.discount_percent ? String(plan.discount_percent) : "");
  const [discountAmount, setDiscountAmount] = useState(plan.discount_cents ? String(plan.discount_cents / 100) : "");
  const [sessions, setSessions] = useState<any[]>(
    (plan.sessions || [])
      .slice()
      .sort((a: any, b: any) => a.session_number - b.session_number)
      .map((s: any) => ({
        id: s.id,
        treatmentId: s.treatment_id,
        sessionNumber: s.session_number,
        intervalWeeksFromPrevious: s.interval_weeks_from_previous ?? 4,
        notes: s.notes ?? "",
        locked: !!s.appointment_id,
        defaultPrice: s.treatment?.price ?? null,
        priceOverride: s.price_cents_override != null ? String(s.price_cents_override / 100) : "",
        expectedResults: s.expected_results ?? "",
        downtime: s.downtime ?? "",
        sessionPurpose: s.session_purpose ?? "",
      })),
  );

  const treatmentMap = new Map(treatments.map((t) => [t.id, t]));

  const subtotalPounds = sessions.reduce((sum, s) => {
    if (s.priceOverride !== "" && s.priceOverride != null) {
      const v = parseFloat(s.priceOverride);
      if (!isNaN(v)) return sum + v;
    }
    const t = s.treatmentId ? treatmentMap.get(s.treatmentId) : null;
    return sum + (t?.price ?? 0);
  }, 0);

  const discountPounds =
    discountType === "percent"
      ? subtotalPounds * (Math.min(100, Math.max(0, parseFloat(discountPercent) || 0)) / 100)
      : discountType === "fixed"
        ? Math.min(subtotalPounds, parseFloat(discountAmount) || 0)
        : 0;
  const grandTotalPounds = Math.max(0, subtotalPounds - discountPounds);

  const addSession = () => {
    setSessions((prev) => [
      ...prev,
      {
        treatmentId: null,
        sessionNumber: prev.length + 1,
        intervalWeeksFromPrevious: prev.length === 0 ? 0 : 4,
        notes: "",
        priceOverride: "",
        sessionPurpose: "",
        expectedResults: "",
        downtime: "",
      },
    ]);
  };
  const removeSession = (idx: number) => {
    setSessions((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sessionNumber: i + 1 })));
  };
  const moveSession = (idx: number, dir: -1 | 1) => {
    setSessions((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      if (prev[idx].locked || prev[target].locked) return prev;
      const next = prev.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((s, i) => ({ ...s, sessionNumber: i + 1, intervalWeeksFromPrevious: i === 0 ? 0 : (s.intervalWeeksFromPrevious || 4) }));
    });
  };
  const generateAiForSession = async (idx: number) => {
    const s = sessions[idx];
    if (!s.treatmentId) {
      toast.error("Pick a treatment first");
      return;
    }
    setAiBusyIdx(idx);
    try {
      const r: any = await aiSession({
        data: {
          clientId,
          treatmentId: s.treatmentId,
          sessionNumber: s.sessionNumber,
        },
      });
      setSessions((prev) =>
        prev.map((x, i) =>
          i === idx
            ? {
                ...x,
                sessionPurpose: r.sessionPurpose || x.sessionPurpose,
                expectedResults: r.expectedResults || x.expectedResults,
                downtime: r.downtime || x.downtime,
                notes: x.notes || r.notes || "",
              }
            : x,
        ),
      );
      toast.success("AI filled this session");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAiBusyIdx(null);
    }
  };


  const save = async () => {
    try {
      await update({
        data: {
          id: plan.id,
          name,
          description,
          bookingMode,
          paymentMode,
          coursePriceCents: coursePrice ? Math.round(parseFloat(coursePrice) * 100) : null,
          depositCents: deposit ? Math.round(parseFloat(deposit) * 100) : null,
          discountCents: discountType === "fixed" && discountAmount ? Math.round(parseFloat(discountAmount) * 100) : null,
          discountPercent: discountType === "percent" && discountPercent ? parseFloat(discountPercent) : null,
          sessions: sessions
            .filter((s) => !s.locked)
            .map((s) => ({
              treatmentId: s.treatmentId,
              sessionNumber: s.sessionNumber,
              intervalWeeksFromPrevious: s.intervalWeeksFromPrevious,
              notes: s.notes,
              priceCentsOverride: s.priceOverride ? Math.round(parseFloat(s.priceOverride) * 100) : null,
              expectedResults: s.expectedResults || null,
              downtime: s.downtime || null,
              sessionPurpose: s.sessionPurpose || null,
            })),
        },
      });
      toast.success("Plan saved");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Booking</Label>
              <Select value={bookingMode} onValueChange={(v) => setBookingMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rolling">Rolling (book one at a time)</SelectItem>
                  <SelectItem value="upfront">Upfront (book all sessions)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment</Label>
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_session">Pay per session</SelectItem>
                  <SelectItem value="course_upfront">Pay course upfront</SelectItem>
                  <SelectItem value="deposit_then_per_session">Deposit + per session</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Course price override (£)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Auto from sessions"
                value={coursePrice}
                onChange={(e) => setCoursePrice(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Optional. Leave blank to use the sum of session prices.</p>
            </div>
            {paymentMode === "deposit_then_per_session" && (
              <div>
                <Label>Deposit (£)</Label>
                <Input type="number" step="0.01" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
              </div>
            )}
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Discount</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No discount</SelectItem>
                  <SelectItem value="percent">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed amount (£)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {discountType === "percent" && (
              <Input type="number" step="0.1" min="0" max="100" placeholder="e.g. 10"
                value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
            )}
            {discountType === "fixed" && (
              <Input type="number" step="0.01" min="0" placeholder="e.g. 50"
                value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
            )}
            <div className="flex items-center justify-between pt-1 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPounds(subtotalPounds)}</span>
            </div>
            {discountPounds > 0 && (
              <div className="flex items-center justify-between text-sm text-emerald-700">
                <span>Discount</span>
                <span>−{formatPounds(discountPounds)}</span>
              </div>
            )}
            <div className="flex items-center justify-between font-medium">
              <span>Total</span>
              <span>{formatPounds(grandTotalPounds)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sessions</Label>
              <Button size="sm" variant="outline" onClick={addSession}>
                <Plus className="h-3 w-3 mr-1" /> Add session
              </Button>
            </div>
            {sessions.map((s, idx) => {
              const t = s.treatmentId ? treatmentMap.get(s.treatmentId) : null;
              return (
                <div key={idx} className="rounded border p-2 space-y-2">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="font-medium">Session {s.sessionNumber}</span>
                    <div className="flex items-center gap-1">
                      {!s.locked && (
                        <>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={idx === 0 || sessions[idx - 1]?.locked} onClick={() => moveSession(idx, -1)} title="Move up">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={idx === sessions.length - 1} onClick={() => moveSession(idx, 1)} title="Move down">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            disabled={!s.treatmentId || aiBusyIdx === idx}
                            onClick={() => generateAiForSession(idx)}
                            title={s.treatmentId ? "Generate this session with AI" : "Pick a treatment first"}
                          >
                            {aiBusyIdx === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            <span className="ml-1">AI</span>
                          </Button>
                        </>
                      )}
                      {s.locked ? (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Booked
                        </Badge>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeSession(idx)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <TreatmentPicker
                      treatments={treatments}
                      categories={categories}
                      value={s.treatmentId ?? null}
                      disabled={s.locked}
                      placeholder="Choose treatment"
                      className="h-9 text-xs"
                      onSelect={(v) =>
                        setSessions((prev) => prev.map((x, i) => (i === idx ? { ...x, treatmentId: v } : x)))
                      }
                    />
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        className="text-xs"
                        value={s.intervalWeeksFromPrevious}
                        onChange={(e) =>
                          setSessions((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, intervalWeeksFromPrevious: parseInt(e.target.value) || 0 } : x)),
                          )
                        }
                        disabled={s.locked || idx === 0}
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">wks after prev</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Price override (£)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="text-xs"
                      placeholder={t?.price != null ? `Default £${t.price}` : "Enter price"}
                      value={s.priceOverride}
                      onChange={(e) =>
                        setSessions((prev) => prev.map((x, i) => (i === idx ? { ...x, priceOverride: e.target.value } : x)))
                      }
                      disabled={s.locked}
                    />
                  </div>
                  <div className="space-y-1.5 pt-1 border-t">
                    <div>
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Session purpose (shown to patient)</Label>
                      <Textarea
                        rows={2}
                        className="text-xs"
                        placeholder="What this session targets and why"
                        value={s.sessionPurpose}
                        onChange={(e) =>
                          setSessions((prev) => prev.map((x, i) => (i === idx ? { ...x, sessionPurpose: e.target.value } : x)))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Expected results</Label>
                      <Textarea
                        rows={2}
                        className="text-xs"
                        placeholder="What the patient should notice after this session"
                        value={s.expectedResults}
                        onChange={(e) =>
                          setSessions((prev) => prev.map((x, i) => (i === idx ? { ...x, expectedResults: e.target.value } : x)))
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">Downtime &amp; aftercare</Label>
                      <Textarea
                        rows={2}
                        className="text-xs"
                        placeholder="Expected downtime, side effects, aftercare notes"
                        value={s.downtime}
                        onChange={(e) =>
                          setSessions((prev) => prev.map((x, i) => (i === idx ? { ...x, downtime: e.target.value } : x)))
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "accepted" || status === "in_progress" || status === "completed") return "default";
  if (status === "sent") return "secondary";
  if (status === "declined" || status === "cancelled") return "destructive";
  return "outline";
}

function paymentModeLabel(m: string) {
  if (m === "course_upfront") return "Pay upfront";
  if (m === "deposit_then_per_session") return "Deposit + per session";
  return "Pay per session";
}

function formatPounds(v: number) {
  return `£${(Math.round(v * 100) / 100).toFixed(2)}`;
}

function formatMoney(cents: number) {
  return formatPounds(cents / 100);
}

/** Compute subtotal (sum of session prices), discount and grand total in cents. */
function computePlanPricing(p: any): { subtotal: number; discount: number; grandTotal: number } {
  const sessions = (p.sessions || []) as any[];
  const subtotal = sessions.reduce((sum, s) => {
    if (s.price_cents_override != null) return sum + s.price_cents_override;
    const treatmentPrice = s.treatment?.price;
    if (typeof treatmentPrice === "number") return sum + Math.round(treatmentPrice * 100);
    return sum;
  }, 0);
  const base = p.course_price_cents != null ? p.course_price_cents : subtotal;
  let discount = 0;
  if (p.discount_percent) discount = Math.round(base * (Number(p.discount_percent) / 100));
  else if (p.discount_cents) discount = Math.min(base, Number(p.discount_cents));
  const grandTotal = Math.max(0, base - discount);
  return { subtotal: base, discount, grandTotal };
}

