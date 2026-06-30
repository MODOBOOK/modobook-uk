import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyTreatments } from "@/lib/treatments.functions";
import { getMyQuizConfig, saveQuizConfig, saveTreatmentQuizTags, listMyQuizResponses } from "@/lib/quiz.functions";
import { QUIZ_QUESTIONS, type QuizTags } from "@/lib/quiz-questions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Save, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SaveReminder } from "@/components/SaveReminder";

export const Route = createFileRoute("/_authenticated/dashboard/quiz")({
  component: QuizBuilder,
});

type Treatment = { id: string; name: string; quiz_tags: Record<string, string[]> | null; active: boolean };

function QuizBuilder() {
  const fetchCfg = useServerFn(getMyQuizConfig);
  const saveCfg = useServerFn(saveQuizConfig);
  const fetchTs = useServerFn(getMyTreatments);
  const saveTags = useServerFn(saveTreatmentQuizTags);
  const fetchResponses = useServerFn(listMyQuizResponses);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [intro, setIntro] = useState("");
  const [outro, setOutro] = useState("");
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [tagsMap, setTagsMap] = useState<Record<string, QuizTags>>({});
  const [responses, setResponses] = useState<Array<{ id: string; created_at: string; patient_name: string | null; patient_email: string | null; answers: Record<string, string[]>; recommended_treatment_ids: string[] }>>([]);

  useEffect(() => {
    (async () => {
      const [cfg, tList, r] = await Promise.all([fetchCfg(), fetchTs(), fetchResponses()]);
      setEnabled(!!cfg?.quiz_enabled);
      setIntro(cfg?.quiz_intro ?? "");
      setOutro(cfg?.quiz_outro ?? "");
      // slug for preview link
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data: p } = await supabase.from("profiles").select("slug").eq("user_id", u.user.id).single();
        setSlug(p?.slug ?? "");
      }
      const ts = (tList as Treatment[]).filter((t) => t.active);
      setTreatments(ts);
      const map: Record<string, QuizTags> = {};
      for (const t of ts) map[t.id] = (t.quiz_tags as QuizTags) ?? {};
      setTagsMap(map);
      setResponses(r as typeof responses);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSaveConfig() {
    setSaving(true);
    try {
      await saveCfg({ data: { quiz_enabled: enabled, quiz_intro: intro, quiz_outro: outro } });
      toast.success("Quiz settings saved");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  async function onSaveTags(id: string) {
    try {
      await saveTags({ data: { id, quiz_tags: tagsMap[id] ?? {} } });
      toast.success("Tags saved");
    } catch (e) { toast.error((e as Error).message); }
  }

  function toggleTag(treatmentId: string, qId: string, option: string) {
    setTagsMap((prev) => {
      const cur = { ...(prev[treatmentId] ?? {}) } as QuizTags;
      const list = new Set((cur[qId as keyof QuizTags] as string[] | undefined) ?? []);
      if (list.has(option)) list.delete(option); else list.add(option);
      (cur as Record<string, string[]>)[qId] = Array.from(list);
      return { ...prev, [treatmentId]: cur };
    });
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="max-w-4xl space-y-6 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5" /> Treatment finder quiz</h1>
          <p className="text-sm text-muted-foreground">A separate entry button on your booking page that asks patients 8 short questions and recommends the best-matching treatments you offer.</p>
        </div>
        {slug && enabled && (
          <Button size="sm" variant="outline" asChild>
            <Link to="/m/$slug/quiz" params={{ slug }} target="_blank">
              <ExternalLink className="mr-1 h-4 w-4" /> Preview quiz
            </Link>
          </Button>
        )}
      </div>

      <SaveReminder message="Each section below has its own Save button — remember to tap it after editing settings or treatment tags." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
          <CardDescription>Turn the quiz on to add a "Take our treatment finder quiz" button to your booking page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Enable quiz</Label>
              <p className="text-xs text-muted-foreground">When off, the button is hidden from patients.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Intro message</Label>
            <Textarea rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="A few quick questions and we'll suggest the best treatment for you." />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Closing message (shown above the results)</Label>
            <Textarea rows={2} value={outro} onChange={(e) => setOutro(e.target.value)} placeholder="Here's what we'd recommend. If you'd like a chat first, book a consultation below." />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={onSaveConfig} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tag your treatments</CardTitle>
          <CardDescription>For each treatment, tick the answers it's a good match for. The quiz scores treatments by overlap and shows the top 3.</CardDescription>
        </CardHeader>
        <CardContent>
          {treatments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active treatments yet. Add some on the Services page first.</p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {treatments.map((t) => {
                const tags = tagsMap[t.id] ?? {};
                const totalTagged = Object.values(tags).reduce((n, arr) => n + (arr?.length ?? 0), 0);
                return (
                  <AccordionItem key={t.id} value={t.id}>
                    <AccordionTrigger className="text-left">
                      <span className="flex items-center gap-2">
                        <span>{t.name}</span>
                        {totalTagged > 0 && <Badge variant="secondary" className="text-[10px]">{totalTagged} tags</Badge>}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {QUIZ_QUESTIONS.map((q) => {
                          const selected = new Set((tags[q.id] as string[] | undefined) ?? []);
                          return (
                            <div key={q.id}>
                              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{q.label}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {q.options.map((opt) => {
                                  const on = selected.has(opt);
                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => toggleTag(t.id, q.id, opt)}
                                      className={"rounded-full border px-3 py-1 text-xs transition " + (on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent")}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex justify-end">
                          <Button size="sm" onClick={() => onSaveTags(t.id)}>
                            <Save className="h-4 w-4 mr-1" /> Save tags for {t.name}
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent quiz submissions</CardTitle>
          <CardDescription>Latest 50 quizzes patients have completed.</CardDescription>
        </CardHeader>
        <CardContent>
          {responses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No submissions yet.</p>
          ) : (
            <ul className="divide-y">
              {responses.map((r) => (
                <li key={r.id} className="py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{r.patient_name || r.patient_email || "Anonymous patient"}</span>
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.recommended_treatment_ids.length} treatments recommended</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
