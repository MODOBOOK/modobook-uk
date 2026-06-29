import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getQuizBySlug, submitQuizResponse } from "@/lib/quiz.functions";
import { QUIZ_QUESTIONS, scoreTreatment, type QuizAnswers } from "@/lib/quiz-questions";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronLeft, ChevronRight, Sparkles, Stethoscope } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

type Treatment = {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  picture_url: string | null;
  session_count?: number | null;
  session_interval_days?: number | null;
  quiz_tags: Record<string, string[]>;
};

function formatSessionSpacing(days?: number | null) {
  if (!days || days <= 0) return null;
  if (days % 7 === 0) {
    const weeks = days / 7;
    return `every ${weeks} week${weeks === 1 ? "" : "s"}`;
  }
  return `every ${days} day${days === 1 ? "" : "s"}`;
}

type Config = {
  profile_id: string;
  quiz_enabled: boolean;
  quiz_intro: string | null;
  quiz_outro: string | null;
  chooser_consultation_treatment_id: string | null;
};

export function QuizDialog({
  open,
  onOpenChange,
  slug,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  slug: string;
}) {
  const fetchQuiz = useServerFn(getQuizBySlug);
  const submit = useServerFn(submitQuizResponse);

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [showResults, setShowResults] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setStep(0);
    setAnswers({});
    setShowResults(false);
    setSubmitted(false);
    (async () => {
      try {
        const r = await fetchQuiz({ data: { slug } });
        setConfig(r.config as Config);
        setTreatments((r.treatments ?? []) as Treatment[]);
      } catch {
        /* noop */
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slug]);

  const ranked = useMemo(() => {
    const scored = treatments.map((t) => ({ t, s: scoreTreatment(answers, t.quiz_tags ?? {}) }));
    scored.sort((a, b) => b.s - a.s);
    return scored.filter((x) => x.s > 0).slice(0, 3);
  }, [answers, treatments]);

  function toggle(qId: keyof QuizAnswers, opt: string, multi: boolean) {
    setAnswers((prev) => {
      const cur = new Set(prev[qId] ?? []);
      if (multi) {
        if (cur.has(opt)) cur.delete(opt);
        else cur.add(opt);
      } else {
        cur.clear();
        cur.add(opt);
      }
      return { ...prev, [qId]: Array.from(cur) };
    });
  }

  async function finish() {
    if (!config) return;
    setShowResults(true);
    try {
      await submit({
        data: {
          profile_id: config.profile_id,
          answers: answers as Record<string, string[]>,
          recommended_treatment_ids: ranked.map((r) => r.t.id),
          patient_name: name || undefined,
          patient_email: email || undefined,
        },
      });
      setSubmitted(true);
    } catch {
      /* keep silent */
    }
  }

  const q = QUIZ_QUESTIONS[step];
  const picked = new Set(q ? answers[q.id] ?? [] : []);
  const canNext = q ? (answers[q.id]?.length ?? 0) > 0 : false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg md:max-w-xl overflow-y-auto p-6 sm:p-8"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5" /> Treatment finder
          </SheetTitle>
          <SheetDescription>
            Answer a few quick questions and we'll suggest treatments that fit.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">



        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !config?.quiz_enabled ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            This clinic doesn't have the quiz turned on yet.
          </p>
        ) : !showResults ? (
          <div className="space-y-5">
            {step === 0 && config.quiz_intro && (
              <p className="text-center text-sm text-muted-foreground">{config.quiz_intro}</p>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Question {step + 1} of {QUIZ_QUESTIONS.length}
              </span>
              <div className="h-1 flex-1 mx-3 rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${((step + 1) / QUIZ_QUESTIONS.length) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold">{q.label}</h2>
              {q.helper && <p className="text-xs text-muted-foreground mt-1">{q.helper}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {q.options.map((opt) => {
                const on = picked.has(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggle(q.id, opt, q.multi)}
                    className={
                      "rounded-full border px-4 py-2 text-sm transition " +
                      (on
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent")
                    }
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between pt-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={step === 0}
                onClick={() => setStep((s) => s - 1)}
              >
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
          </div>
        ) : (
          <div className="space-y-4">
            {config.quiz_outro && (
              <p className="text-center text-sm text-muted-foreground">{config.quiz_outro}</p>
            )}
            <h3 className="text-xl font-semibold text-center">Your recommended treatments</h3>

            {ranked.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center space-y-3">
                  <p className="text-sm">
                    No close matches yet. We'd recommend a consultation so we can plan something
                    tailored.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {ranked.map(({ t }) => (
                  <Card key={t.id}>
                    <CardContent className="p-4 flex gap-3 items-center">
                      {t.picture_url && (
                        <img
                          src={t.picture_url}
                          alt={t.name}
                          className="h-14 w-14 rounded object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{t.name}</p>
                        {t.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {t.description}
                          </p>
                        )}
                        <p className="text-xs mt-1">
                          {t.duration} min · £{(t.price / 100).toFixed(2)}
                        </p>
                        {(t.session_count ?? 1) > 1 && (
                          <p className="mt-1 text-xs font-semibold text-muted-foreground">
                            {t.session_count} sessions
                            {formatSessionSpacing(t.session_interval_days) ? ` · ${formatSessionSpacing(t.session_interval_days)}` : ""}
                          </p>
                        )}
                      </div>
                      <Button asChild size="sm" onClick={() => onOpenChange(false)}>
                        <Link
                          to="/m/$slug/book/$treatmentId"
                          params={{ slug, treatmentId: t.id }}
                        >
                          Book
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Card className="border-dashed">
              <CardContent className="p-4 space-y-2 text-center">
                <Stethoscope className="h-5 w-5 mx-auto opacity-70" />
                <p className="text-sm">Not sure? A consultation is the safest first step.</p>
                {config.chooser_consultation_treatment_id ? (
                  <Button asChild size="sm" onClick={() => onOpenChange(false)}>
                    <Link
                      to="/m/$slug/book/$treatmentId"
                      params={{ slug, treatmentId: config.chooser_consultation_treatment_id }}
                    >
                      Book a consultation
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => onOpenChange(false)}>
                    Back to booking
                  </Button>
                )}
              </CardContent>
            </Card>

            {!submitted && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-medium">
                    Want us to save these recommendations and follow up?
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Name (optional)</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Email (optional)</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      if (!config) return;
                      try {
                        await submit({
                          data: {
                            profile_id: config.profile_id,
                            answers: answers as Record<string, string[]>,
                            recommended_treatment_ids: ranked.map((r) => r.t.id),
                            patient_name: name || undefined,
                            patient_email: email || undefined,
                          },
                        });
                        setSubmitted(true);
                        toast.success("Sent — the clinic will be in touch.");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    Send to clinic
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
