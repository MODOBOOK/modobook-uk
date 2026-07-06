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
import { Plus, Trash2, Send, Copy, CheckCircle2, ClipboardList, Sparkles, Loader2 } from "lucide-react";
import {
  listPlansForClient,
  createPlanForClient,
  updatePlan,
  sendPlan,
  deletePlan,
  suggestPlanForClient,
} from "@/lib/treatment-plans.functions";
import { supabase } from "@/integrations/supabase/client";

type Treatment = { id: string; name: string; price: number | null; duration: number | null };

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
  const listTpls = useServerFn(listPlanTemplates);

  const [plans, setPlans] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [selectedTpl, setSelectedTpl] = useState<string>("blank");
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<any | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [p, t] = await Promise.all([
        list({ data: { clientId } }),
        listTpls(),
      ]);
      setPlans(p);
      setTemplates(t);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    (async () => {
      const { data } = await supabase
        .from("treatments")
        .select("id,name,price,duration")
        .eq("active", true)
        .order("name");
      setTreatments((data || []) as Treatment[]);
    })();
  }, [clientId]);

  const handleCreate = async () => {
    try {
      const plan = await create({
        data: {
          clientId,
          templateId: selectedTpl === "blank" ? null : selectedTpl,
          consultationId: consultationId ?? null,
          name: newName || undefined,
        },
      });
      toast.success("Plan created");
      setNewOpen(false);
      setNewName("");
      setSelectedTpl("blank");
      await refresh();
      // Open editor
      const fresh = await list({ data: { clientId } });
      const found = fresh.find((p: any) => p.id === plan.id);
      setPlans(fresh);
      if (found) setEditing(found);
    } catch (e: any) {
      toast.error(e.message);
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
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                  {p.status === "draft" && (
                    <Button size="sm" onClick={() => handleSend(p.id)}>
                      <Send className="h-3 w-3 mr-1" /> Send to patient
                    </Button>
                  )}
                  {p.status !== "draft" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/m/${window.location.pathname}`);
                        toast.success("Link copied");
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Share
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
            <DialogDescription>Start blank or from a template you've saved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Template</Label>
              <Select value={selectedTpl} onValueChange={setSelectedTpl}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">Blank plan</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plan name (optional)</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Skin rejuvenation course" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit plan */}
      {editing && (
        <EditPlanDialog
          plan={editing}
          treatments={treatments}
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
  treatments,
  onClose,
  onSaved,
}: {
  plan: any;
  treatments: Treatment[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const update = useServerFn(updatePlan);
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? "");
  const [bookingMode, setBookingMode] = useState(plan.booking_mode);
  const [paymentMode, setPaymentMode] = useState(plan.payment_mode);
  const [coursePrice, setCoursePrice] = useState(plan.course_price_cents ? String(plan.course_price_cents / 100) : "");
  const [deposit, setDeposit] = useState(plan.deposit_cents ? String(plan.deposit_cents / 100) : "");
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
      })),
  );

  const addSession = () => {
    setSessions((prev) => [
      ...prev,
      {
        treatmentId: null,
        sessionNumber: prev.length + 1,
        intervalWeeksFromPrevious: 4,
        notes: "",
      },
    ]);
  };
  const removeSession = (idx: number) => {
    setSessions((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sessionNumber: i + 1 })));
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
          sessions: sessions
            .filter((s) => !s.locked)
            .map((s) => ({
              treatmentId: s.treatmentId,
              sessionNumber: s.sessionNumber,
              intervalWeeksFromPrevious: s.intervalWeeksFromPrevious,
              notes: s.notes,
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rolling">Rolling (book one at a time)</SelectItem>
                  <SelectItem value="upfront">Upfront (book all sessions)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment</Label>
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_session">Pay per session</SelectItem>
                  <SelectItem value="course_upfront">Pay course upfront</SelectItem>
                  <SelectItem value="deposit_then_per_session">Deposit + per session</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {paymentMode === "course_upfront" && (
            <div>
              <Label>Course price (£)</Label>
              <Input type="number" step="0.01" value={coursePrice} onChange={(e) => setCoursePrice(e.target.value)} />
            </div>
          )}
          {paymentMode === "deposit_then_per_session" && (
            <div>
              <Label>Deposit (£)</Label>
              <Input type="number" step="0.01" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sessions</Label>
              <Button size="sm" variant="outline" onClick={addSession}>
                <Plus className="h-3 w-3 mr-1" /> Add session
              </Button>
            </div>
            {sessions.map((s, idx) => (
              <div key={idx} className="rounded border p-2 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Session {s.sessionNumber}</span>
                  {s.locked ? (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Booked
                    </Badge>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => removeSession(idx)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={s.treatmentId ?? ""}
                    onValueChange={(v) =>
                      setSessions((prev) => prev.map((x, i) => (i === idx ? { ...x, treatmentId: v } : x)))
                    }
                    disabled={s.locked}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Choose treatment" />
                    </SelectTrigger>
                    <SelectContent>
                      {treatments.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <span className="text-xs text-muted-foreground">wks after prev</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
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
