import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getQuizBySlug, submitQuizResponse } from "@/lib/quiz.functions";
import { QUIZ_QUESTIONS, scoreTreatment, type QuizAnswers } from "@/lib/quiz-questions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronLeft, ChevronRight, Sparkles, Stethoscope } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/m/$slug/quiz")({
  component: QuizPage,
});

type Treatment = { id: string; name: string; description: string | null; duration: number; price: number; picture_url: string | null; quiz_tags: Record<string, string[]> };

function QuizPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const fetchQuiz = useServerFn(getQuizBySlug);
  const submit = useServerFn(submitQuizResponse);

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<{ profile_id: string; quiz_enabled: boolean; quiz_intro: string | null; quiz_outro: string | null; chooser_consultation_treatment_id: string | null } | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [step, setStep] = useState(0); // 0..QUIZ_QUESTIONS.length-1, then results
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [showResults, setShowResults] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchQuiz({ data: { slug } });
        setConfig(r.config as typeof config);
        setTreatments((r.treatments ?? []) as Treatment[]);
      } catch { /* swallow */ }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const ranked = useMemo(() => {
    const scored = treatments.map((t) => ({ t, s: scoreTreatment(answers, t.quiz_tags ?? {}) }));
    scored.sort((a, b) => b.s - a.s);
    return scored.filter((x) => x.s > 0).slice(0, 3);
  }, [answers, treatments]);

  function toggle(qId: keyof QuizAnswers, opt: string, multi: boolean) {
    setAnswers((prev) => {
      const cur = new Set(prev[qId] ?? []);
      if (multi) {
        if (cur.has(opt)) cur.delete(opt); else cur.add(opt);
      } else {
        cur.clear(); cur.add(opt);
      }
      return { ...prev, [qId]: Array.from(cur) };
    });
  }

  async function finish() {
    if (!config) return;
    setShowResults(true);
    try {
      await submit({ data: {
        profile_id: config.profile_id,
        answers: answers as Record<string, string[]>,
        recommended_treatment_ids: ranked.map((r) => r.t.id),
        patient_name: name || undefined,
        patient_email: email || undefined,
      }});
      setSubmitted(true);
    } catch { /* keep silent */ }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!config?.quiz_enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md"><CardContent className="p-6 text-center space-y-3">
          <p>This clinic doesn't have the quiz turned on yet.</p>
          <Button asChild><Link to="/m/$slug" params={{ slug }}>Back to booking</Link></Button>
        </CardContent></Card>
      </div>
    );
  }

  const q = QUIZ_QUESTIONS[step];
  const picked = new Set(answers[q?.id] ?? []);
  const canNext = (answers[q?.id]?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Button size="sm" variant="ghost" asChild>
            <Link to="/m/$slug" params={{ slug }}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Link>
          </Button>
          <span className="text-xs text-muted-foreground">Treatment finder</span>
        </div>

        {!showResults ? (
          <Card>
            <CardContent className="p-6 space-y-6">
              {step === 0 && config.quiz_intro && (
                <p className="text-center text-sm text-muted-foreground">{config.quiz_intro}</p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Question {step + 1} of {QUIZ_QUESTIONS.length}</span>
                <div className="h-1 flex-1 mx-3 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / QUIZ_QUESTIONS.length) * 100}%` }} />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold">{q.label}</h2>
                {q.helper && <p className="text-xs text-muted-foreground mt-1">{q.helper}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const on = picked.has(opt);
                  return (
                    <button key={opt} type="button" onClick={() => toggle(q.id, opt, q.multi)}
                      className={"rounded-full border px-4 py-2 text-sm transition " + (on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent")}>
                      {opt}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between pt-2">
                <Button size="sm" variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                {step < QUIZ_QUESTIONS.length - 1 ? (
                  <Button size="sm" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button size="sm" disabled={!canNext} onClick={finish}>
                    See my recommendations <Sparkles className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {config.quiz_outro && <p className="text-center text-sm text-muted-foreground">{config.quiz_outro}</p>}
            <h2 className="text-2xl font-semibold text-center">Your recommended treatments</h2>

            {ranked.length === 0 ? (
              <Card><CardContent className="p-6 text-center space-y-3">
                <p>No close matches yet. We'd recommend a consultation so we can plan something tailored.</p>
              </CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {ranked.map(({ t }) => (
                  <Card key={t.id}>
                    <CardContent className="p-4 flex gap-4 items-center">
                      {t.picture_url && <img src={t.picture_url} alt={t.name} className="h-16 w-16 rounded object-cover" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{t.name}</p>
                        {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                        <p className="text-xs mt-1">{t.duration} min · £{(t.price / 100).toFixed(2)}</p>
                      </div>
                      <Button size="sm" onClick={() => navigate({ to: "/m/$slug", params: { slug }, search: { treatment: t.id } as never })}>Book</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Card className="border-dashed">
              <CardContent className="p-5 space-y-3 text-center">
                <Stethoscope className="h-6 w-6 mx-auto opacity-70" />
                <p className="text-sm">Not sure? A consultation is the safest first step.</p>
                <Button asChild>
                  <Link to="/m/$slug" params={{ slug }} search={config.chooser_consultation_treatment_id ? { treatment: config.chooser_consultation_treatment_id } as never : undefined}>
                    Book a consultation
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {!submitted && (
              <Card>
                <CardContent className="p-5 space-y-3">
                  <p className="text-sm font-medium">Want us to save these recommendations and follow up?</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div><Label className="text-xs">Name (optional)</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                    <div><Label className="text-xs">Email (optional)</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={async () => {
                    if (!config) return;
                    try {
                      await submit({ data: { profile_id: config.profile_id, answers: answers as Record<string, string[]>, recommended_treatment_ids: ranked.map((r) => r.t.id), patient_name: name || undefined, patient_email: email || undefined } });
                      setSubmitted(true); toast.success("Sent — the clinic will be in touch.");
                    } catch (e) { toast.error((e as Error).message); }
                  }}>Send to clinic</Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
