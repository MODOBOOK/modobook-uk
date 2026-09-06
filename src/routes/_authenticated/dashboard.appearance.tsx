import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { getMyTheme, upsertMyTheme } from "@/lib/theme.functions";
import { DASHBOARD_PALETTES, DASHBOARD_FONTS } from "@/lib/dashboard-appearance";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Monitor } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/appearance")({
  component: AppearancePage,
  head: () => ({
    meta: [
      { title: "Workspace appearance | MODO" },
      { name: "description", content: "Change the colours and fonts of your own MODO workspace without changing your patient booking page." },
    ],
  }),
});

function AppearancePage() {
  const load = useServerFn(getMyTheme);
  const save = useServerFn(upsertMyTheme);
  const qc = useQueryClient();

  const [follow, setFollow] = useState(true);
  const [palette, setPalette] = useState<string>("warm-sand");
  const [heading, setHeading] = useState<string>("Plus Jakarta Sans");
  const [body, setBody] = useState<string>("Plus Jakarta Sans");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load().then((t: Record<string, unknown> | null) => {
      if (!t) return;
      setFollow(t["dashboard_follow_brand"] !== false);
      if (t["dashboard_palette"]) setPalette(String(t["dashboard_palette"]));
      if (t["dashboard_heading_font"]) setHeading(String(t["dashboard_heading_font"]));
      if (t["dashboard_body_font"]) setBody(String(t["dashboard_body_font"]));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await save({
        data: {
          dashboard_follow_brand: follow,
          dashboard_palette: palette,
          dashboard_heading_font: heading,
          dashboard_body_font: body,
        },
      });
      await qc.invalidateQueries({ queryKey: ["my-theme"] });
      toast.success("Workspace appearance saved");
    } catch {
      toast.error("Could not save — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 p-4 pb-28 sm:p-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-4 w-4 text-primary" />
            Your workspace look
          </CardTitle>
          <CardDescription>
            These colours and fonts only change what you see when you're signed in. Your patient booking
            page keeps its own branding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0 flex-1">
              <Label className="text-sm">Match my booking page branding</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Turn this off to pick a separate look just for your workspace.
              </p>
            </div>
            <Switch checked={follow} onCheckedChange={setFollow} className="ml-auto shrink-0" />
          </div>

          {!follow && (
            <>
              <div className="space-y-2">
                <Label className="text-sm">Colour scheme</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {DASHBOARD_PALETTES.map((p) => {
                    const active = p.key === palette;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setPalette(p.key)}
                        className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                          active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <span className="flex shrink-0 overflow-hidden rounded-md border border-border">
                          {p.swatches.map((c) => (
                            <span key={c} className="h-7 w-4" style={{ background: c }} />
                          ))}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{p.tagline}</span>
                        </span>
                        {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm">Heading font</Label>
                  <Select value={heading} onValueChange={setHeading}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DASHBOARD_FONTS.map((f) => (
                        <SelectItem key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Body font</Label>
                  <Select value={body} onValueChange={setBody}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DASHBOARD_FONTS.map((f) => (
                        <SelectItem key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? "Saving…" : "Save appearance"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
