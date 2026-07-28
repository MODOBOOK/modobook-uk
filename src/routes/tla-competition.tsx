import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { enterCompetition, COMPETITION_CONSENT_TEXT } from "@/lib/competition.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import wordmark from "@/assets/modo-wordmark.png.asset.json";
import { Trophy, Sparkles, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/tla-competition")({
  head: () => ({
    meta: [
      { title: "MODO x TLAs competition entry" },
      {
        name: "description",
        content: "Private entry form for the MODO Book pop-up competition at The Little Aesthetics Store events.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "MODO x TLAs competition entry" },
      {
        property: "og:description",
        content: "Private entry form for the MODO Book pop-up competition.",
      },
    ],
  }),
  component: CompetitionPage,
});

const PRIZES = [
  { place: "1st prize", body: "6 months of MODO Book, completely free." },
  { place: "2nd & 3rd prize", body: "3 months of MODO Book, completely free." },
];

function CompetitionPage() {
  const submit = useServerFn(enterCompetition);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { duplicate: boolean }>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    clinicName: "",
    instagram: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [consent, setConsent] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(true);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid =
    form.fullName.trim().length > 1 &&
    form.clinicName.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(form.email) &&
    consent;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await submit({
        data: {
          fullName: form.fullName,
          clinicName: form.clinicName,
          instagram: form.instagram || null,
          email: form.email,
          phone: form.phone || null,
          notes: form.notes || null,
          consent,
          marketingOptIn,
        },
      });
      if (res.ok) setDone({ duplicate: !!res.duplicate });
      else setError(res.error ?? "Something went wrong.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modo-marketing min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]">
      <main className="mx-auto max-w-3xl px-5 py-14 lg:py-20">
        <img src={wordmark.url} alt="MODO Book" className="h-9 w-auto object-contain" />

        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/25 bg-[color:var(--clinical-blue-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent)]">
          <Sparkles className="h-3.5 w-3.5" />
          TLAs pop-up · invite only
        </div>

        <h1 className="mt-5 text-3xl font-bold leading-[1.08] tracking-tight sm:text-4xl">
          Win up to 6 months of MODO Book, free.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[color:var(--ink-soft)]">
          Thanks for visiting us at the TLAs pop-up. Pop your details in below to enter —
          winners are drawn after the event and contacted by email.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {PRIZES.map((p) => (
            <Card key={p.place} className="border-[color:var(--accent)]/20">
              <CardContent className="flex items-start gap-3 p-4">
                <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--accent)]" />
                <div>
                  <p className="text-sm font-semibold">{p.place}</p>
                  <p className="text-sm text-[color:var(--ink-soft)]">{p.body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {done ? (
          <Card className="mt-10">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[color:var(--accent)]" />
              <h2 className="mt-4 text-xl font-semibold">
                {done.duplicate ? "You're already entered" : "You're in the draw"}
              </h2>
              <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
                {done.duplicate
                  ? "We already have an entry under that email address — good luck!"
                  : "Good luck! We'll email the winners after the event."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={onSubmit} className="mt-10 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name *</Label>
                <Input id="fullName" value={form.fullName} onChange={set("fullName")} maxLength={120} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinicName">Clinic / business name *</Label>
                <Input id="clinicName" value={form.clinicName} onChange={set("clinicName")} maxLength={160} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={form.email} onChange={set("email")} maxLength={255} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram handle</Label>
                <Input id="instagram" placeholder="@yourclinic" value={form.instagram} onChange={set("instagram")} maxLength={120} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" value={form.phone} onChange={set("phone")} maxLength={40} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Anything you'd like us to know? (optional)</Label>
                <Textarea id="notes" rows={3} value={form.notes} onChange={set("notes")} maxLength={1000} />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-[color:var(--accent)]/15 bg-white/50 p-4">
              <label className="flex items-start gap-3 text-sm leading-relaxed">
                <Checkbox
                  checked={consent}
                  onCheckedChange={(v) => setConsent(v === true)}
                  className="mt-0.5"
                  aria-label="Competition consent"
                />
                <span className="text-[color:var(--ink-soft)]">{COMPETITION_CONSENT_TEXT}</span>
              </label>
              <label className="flex items-start gap-3 text-sm leading-relaxed">
                <Checkbox
                  checked={marketingOptIn}
                  onCheckedChange={(v) => setMarketingOptIn(v === true)}
                  className="mt-0.5"
                  aria-label="Marketing opt in"
                />
                <span className="text-[color:var(--ink-soft)]">
                  Keep me updated about MODO Book launch news and offers. I can unsubscribe any time.
                </span>
              </label>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" size="lg" disabled={!valid || busy} className="w-full sm:w-auto">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {busy ? "Entering…" : "Enter the competition"}
            </Button>

            <p className="text-xs text-[color:var(--ink-soft)]">
              One entry per person. Open to UK aesthetics practitioners aged 18+ who attended the
              TLAs pop-up. Winners drawn at random and notified by email; prizes are free MODO Book
              subscription months and have no cash alternative.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
