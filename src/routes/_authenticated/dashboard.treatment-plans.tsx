import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil } from "lucide-react";
import { listPlanTemplates, upsertPlanTemplate, deletePlanTemplate } from "@/lib/treatment-plans.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard/treatment-plans")({
  ssr: false,
  component: TemplatesPage,
});

type Treatment = { id: string; name: string; price: number | null };

function TemplatesPage() {
  const list = useServerFn(listPlanTemplates);
  const upsert = useServerFn(upsertPlanTemplate);
  const del = useServerFn(deletePlanTemplate);
  const [templates, setTemplates] = useState<any[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      setTemplates(await list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    (async () => {
      const { data } = await supabase.from("treatments").select("id,name,price").eq("active", true).order("name");
      setTreatments((data || []) as Treatment[]);
    })();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await del({ data: { id } });
    toast.success("Deleted");
    refresh();
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Treatment plan templates</h1>
          <p className="text-sm text-muted-foreground">
            Reusable multi-session plans you can assign to patients (from a consultation or their profile).
          </p>
        </div>
        <Button onClick={() => setEditing({ items: [] })}>
          <Plus className="h-4 w-4 mr-1" /> New template
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No templates yet. Create one to reuse when building patient plans.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(t.items || []).length} sessions · {t.booking_mode === "upfront" ? "Book upfront" : "Rolling"} ·{" "}
                    {paymentModeLabel(t.payment_mode)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              {t.description && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                </CardContent>
              )}
              {t.items && t.items.length > 0 && (
                <CardContent className="pt-0 flex flex-wrap gap-1">
                  {t.items
                    .slice()
                    .sort((a: any, b: any) => a.session_number - b.session_number)
                    .map((it: any) => (
                      <Badge key={it.id} variant="outline" className="text-xs">
                        {it.session_number}. {it.treatment?.name ?? "—"}
                      </Badge>
                    ))}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <TemplateEditor
          template={editing}
          treatments={treatments}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
          upsert={upsert}
        />
      )}
    </div>
  );
}

function TemplateEditor({
  template,
  treatments,
  onClose,
  onSaved,
  upsert,
}: {
  template: any;
  treatments: Treatment[];
  onClose: () => void;
  onSaved: () => void;
  upsert: any;
}) {
  const [name, setName] = useState(template.name ?? "");
  const [description, setDescription] = useState(template.description ?? "");
  const [defaultInterval, setDefaultInterval] = useState(template.default_interval_weeks ?? 4);
  const [bookingMode, setBookingMode] = useState(template.booking_mode ?? "rolling");
  const [paymentMode, setPaymentMode] = useState(template.payment_mode ?? "per_session");
  const [coursePrice, setCoursePrice] = useState(
    template.course_price_cents ? String(template.course_price_cents / 100) : "",
  );
  const [deposit, setDeposit] = useState(template.deposit_cents ? String(template.deposit_cents / 100) : "");
  const [items, setItems] = useState<any[]>(
    (template.items || [])
      .slice()
      .sort((a: any, b: any) => a.session_number - b.session_number)
      .map((i: any) => ({
        treatmentId: i.treatment_id,
        sessionNumber: i.session_number,
        intervalWeeksFromPrevious: i.interval_weeks_from_previous ?? 4,
        notes: i.notes ?? "",
      })),
  );

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        treatmentId: null,
        sessionNumber: prev.length + 1,
        intervalWeeksFromPrevious: prev.length === 0 ? 0 : defaultInterval,
        notes: "",
      },
    ]);
  };
  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sessionNumber: i + 1 })));
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    try {
      await upsert({
        data: {
          id: template.id,
          name,
          description,
          defaultIntervalWeeks: defaultInterval,
          bookingMode,
          paymentMode,
          coursePriceCents: coursePrice ? Math.round(parseFloat(coursePrice) * 100) : null,
          depositCents: deposit ? Math.round(parseFloat(deposit) * 100) : null,
          items,
        },
      });
      toast.success("Template saved");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template.id ? "Edit template" : "New template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 3-session microneedling course" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Default interval (wks)</Label>
              <Input
                type="number"
                value={defaultInterval}
                onChange={(e) => setDefaultInterval(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Booking</Label>
              <Select value={bookingMode} onValueChange={setBookingMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rolling">Rolling</SelectItem>
                  <SelectItem value="upfront">Upfront</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_session">Per session</SelectItem>
                  <SelectItem value="course_upfront">Course upfront</SelectItem>
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
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {items.map((it, idx) => (
              <div key={idx} className="rounded border p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Session {it.sessionNumber}</span>
                  <Button size="sm" variant="ghost" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={it.treatmentId ?? ""}
                    onValueChange={(v) =>
                      setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, treatmentId: v } : x)))
                    }
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
                      value={it.intervalWeeksFromPrevious}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, intervalWeeksFromPrevious: parseInt(e.target.value) || 0 } : x,
                          ),
                        )
                      }
                      disabled={idx === 0}
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">wks after prev</span>
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
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function paymentModeLabel(m: string) {
  if (m === "course_upfront") return "Pay upfront";
  if (m === "deposit_then_per_session") return "Deposit + per session";
  return "Pay per session";
}
