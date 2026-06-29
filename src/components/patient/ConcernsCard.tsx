import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listConcerns, upsertConcern, deleteConcern } from "@/lib/patient-hub.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Check, Plus, Trash2, RotateCcw, Target } from "lucide-react";
import { toast } from "sonner";

type Concern = {
  id: string;
  label: string;
  severity: "low" | "medium" | "high";
  resolved: boolean;
  source: string;
  notes: string | null;
};

const SEVERITY_TONE: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700 border-emerald-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  high: "bg-rose-100 text-rose-700 border-rose-200",
};

export function ConcernsCard({
  clientId,
  predefined = [],
}: {
  clientId: string;
  predefined?: { id: string; name: string }[];
}) {
  const list = useServerFn(listConcerns);
  const save = useServerFn(upsertConcern);
  const del = useServerFn(deleteConcern);

  const [items, setItems] = useState<Concern[]>([]);
  const [label, setLabel] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const r = (await list({ data: { clientId } })) as Concern[];
    setItems(r);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [clientId]);

  async function add() {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await save({ data: { clientId, label: label.trim(), severity, source: "manual" } });
      setLabel("");
      setSeverity("medium");
      await reload();
    } catch (e: any) { toast.error(e.message ?? "Could not save"); }
    finally { setBusy(false); }
  }

  async function toggleResolved(c: Concern) {
    await save({ data: { id: c.id, clientId, label: c.label, severity: c.severity, resolved: !c.resolved } });
    reload();
  }
  async function changeSeverity(c: Concern, sev: "low"|"medium"|"high") {
    await save({ data: { id: c.id, clientId, label: c.label, severity: sev, resolved: c.resolved } });
    reload();
  }
  async function remove(c: Concern) {
    if (!confirm("Remove concern?")) return;
    await del({ data: { id: c.id } });
    reload();
  }

  const active = items.filter(i => !i.resolved);
  const resolved = items.filter(i => i.resolved);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Concerns & goals</h3>
          <span className="ml-auto text-xs text-muted-foreground">{active.length} active</span>
        </div>

        {/* Quick-add from predefined */}
        {predefined.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {predefined.slice(0, 12).map(p => (
              <button
                key={p.id}
                className="rounded-full border bg-card px-2.5 py-1 text-xs hover:bg-muted"
                onClick={async () => {
                  await save({ data: { clientId, label: p.name, severity: "medium", source: "predefined" } });
                  reload();
                }}
              >+ {p.name}</button>
            ))}
          </div>
        )}

        {/* Manual add */}
        <div className="flex gap-2">
          <Input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Add concern (e.g. fine lines, acne)"
            onKeyDown={e => { if (e.key === "Enter") add(); }}
            className="h-9"
          />
          <Select value={severity} onValueChange={v => setSeverity(v as any)}>
            <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={add} disabled={busy}><Plus className="h-4 w-4" /></Button>
        </div>

        {/* Active list */}
        {active.length === 0 && resolved.length === 0 && (
          <p className="text-xs text-muted-foreground">No concerns logged yet.</p>
        )}
        <div className="space-y-1.5">
          {active.map(c => (
            <div key={c.id} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
              <Badge variant="outline" className={SEVERITY_TONE[c.severity]}>{c.severity}</Badge>
              <span className="flex-1 truncate text-sm">{c.label}</span>
              <Select value={c.severity} onValueChange={v => changeSeverity(c, v as any)}>
                <SelectTrigger className="h-7 w-[78px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleResolved(c)} title="Mark resolved">
                <Check className="h-4 w-4 text-emerald-600" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(c)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>

        {resolved.length > 0 && (
          <details className="pt-1">
            <summary className="cursor-pointer text-xs text-muted-foreground">{resolved.length} resolved</summary>
            <div className="mt-2 space-y-1.5">
              {resolved.map(c => (
                <div key={c.id} className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-sm text-muted-foreground line-through">
                  <span className="flex-1 truncate">{c.label}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleResolved(c)} title="Reopen">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(c)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
