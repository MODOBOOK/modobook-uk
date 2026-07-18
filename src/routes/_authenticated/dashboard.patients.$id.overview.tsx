import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLatestBrief, generatePatientBrief } from "@/lib/patient-records.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/patients/$id/overview")({
  ssr: false,
  component: OverviewPage,
});

function OverviewPage() {
  const { id } = Route.useParams();
  const getBrief = useServerFn(getLatestBrief);
  const gen = useServerFn(generatePatientBrief);
  const [brief, setBrief] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await getBrief({ data: { clientId: id } });
        setBrief(r);
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line
  }, [id]);

  async function regenerate() {
    setBusy(true);
    try {
      const r = await gen({ data: { clientId: id } });
      setBrief(r);
      toast.success("Brief updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate brief");
    } finally { setBusy(false); }
  }

  const b = brief?.brief;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">AI patient brief</h2>
        <Button size="sm" onClick={regenerate} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
          {brief ? "Regenerate" : "Generate brief"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : !brief ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          No brief yet. Click <b>Generate brief</b> to summarise this patient's recent history, medications, notes and highlights before their next appointment.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">Generated {new Date(brief.generated_at).toLocaleString()}</div>
          {b?.summary && (
            <Card><CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Summary</div>
              <p className="mt-1 text-sm">{b.summary}</p>
            </CardContent></Card>
          )}
          {Array.isArray(b?.highlights) && b.highlights.length > 0 && (
            <Card><CardContent className="p-4">
              <div className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" /> Highlights
              </div>
              <ul className="ml-4 list-disc space-y-1 text-sm">
                {b.highlights.map((h: string, i: number) => <li key={i}>{h}</li>)}
              </ul>
            </CardContent></Card>
          )}
          {Array.isArray(b?.recent_history) && b.recent_history.length > 0 && (
            <Card><CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Recent history</div>
              <ul className="ml-4 mt-1 list-disc space-y-1 text-sm">
                {b.recent_history.map((h: string, i: number) => <li key={i}>{h}</li>)}
              </ul>
            </CardContent></Card>
          )}
          {Array.isArray(b?.suggested_focus) && b.suggested_focus.length > 0 && (
            <Card><CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Suggested focus next visit</div>
              <ul className="ml-4 mt-1 list-disc space-y-1 text-sm">
                {b.suggested_focus.map((h: string, i: number) => <li key={i}>{h}</li>)}
              </ul>
            </CardContent></Card>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">AI briefs are advisory. Always verify against the patient's full record.</p>
    </div>
  );
}
