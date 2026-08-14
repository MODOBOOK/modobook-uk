import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { joinHairBeautyWaitlist, CLINIC_TYPES } from "@/lib/hair-beauty-waitlist.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import wordmark from "@/assets/modo-wordmark.png.asset.json";
import { Scissors, Sparkles, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/hair-beauty-waitlist")({
  head: () => ({
    meta: [
      { title: "MODO for hair & beauty — private waitlist" },
      {
        name: "description",
        content:
          "Private early-access waitlist for hair and beauty salons who want MODO's booking system built around them.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "MODO for hair & beauty — private waitlist" },
      {
        property: "og:description",
        content: "Join the private waitlist and tell us what you need from a salon booking system.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HairBeautyWaitlistPage,
});

function HairBeautyWaitlistPage() {
  const submit = useServerFn(joinHairBeautyWaitlist);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clinicType, setClinicType] = useState<"hair" | "beauty" | "multi" | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    clinicName: "",
    email: "",
    phone: "",
    instagram: "",
    ideas: "",
  });

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid =
    form.fullName.trim().length > 1 && /\S+@\S+\.\S+/.test(form.email) && !!clinicType;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await submit({
        data: {
          fullName: form.fullName,
          email: form.email,
          clinicName: form.clinicName || null,
          phone: form.phone || null,
          instagram: form.instagram || null,
          clinicType: clinicType!,
          ideas: form.ideas || null,
        },
      });
      if (res.ok) setDone(true);
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
          Hair & beauty · early access
        </div>

        <h1 className="mt-5 text-3xl font-bold leading-[1.08] tracking-tight sm:text-4xl">
          MODO is coming to hair & beauty.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[color:var(--ink-soft)]">
          We're building the salon side of MODO now. Join the private waitlist, tell us what kind of
          salon you run, and shape exactly what goes into the booking system.
        </p>

        {done ? (
          <Card className="mt-10">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[color:var(--accent)]" />
              <h2 className="mt-4 text-xl font-semibold">You're on the list</h2>
              <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
                Thank you — we'll be in touch as soon as hair & beauty opens up, and your ideas go
                straight to the team building it.
              </p>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={onSubmit} className="mt-10 space-y-6">
            <div className="space-y-3 rounded-xl border border-[color:var(--accent)]/15 bg-white/50 p-4">
              <p className="text-sm font-semibold">What kind of salon are you? *</p>
              <div className="grid gap-2">
                {CLINIC_TYPES.map((t) => (
                  <label
                    key={t.value}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-[color:var(--accent)]/15 bg-white/60 px-3 py-3 text-sm"
                  >
                    <Checkbox
                      checked={clinicType === t.value}
                      onCheckedChange={(v) => setClinicType(v === true ? t.value : null)}
                      aria-label={t.label}
                    />
                    <span className="flex items-center gap-2">
                      <Scissors className="h-4 w-4 text-[color:var(--accent)]" />
                      {t.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name *</Label>
                <Input id="fullName" value={form.fullName} onChange={set("fullName")} maxLength={120} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinicName">Salon / business name</Label>
                <Input id="clinicName" value={form.clinicName} onChange={set("clinicName")} maxLength={160} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={form.email} onChange={set("email")} maxLength={255} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={set("phone")} maxLength={40} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="instagram">Instagram handle</Label>
                <Input
                  id="instagram"
                  placeholder="@yoursalon"
                  value={form.instagram}
                  onChange={set("instagram")}
                  maxLength={120}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ideas">What would you want from a booking system?</Label>
                <Textarea
                  id="ideas"
                  rows={5}
                  placeholder="Column rota for stylists, colour patch tests, deposits, retail add-ons, loyalty… tell us anything."
                  value={form.ideas}
                  onChange={set("ideas")}
                  maxLength={2000}
                />
                <p className="text-xs text-[color:var(--ink-soft)]">
                  The more detail the better — we build straight from this feedback.
                </p>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" size="lg" disabled={!valid || busy} className="w-full sm:w-auto">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {busy ? "Joining…" : "Join the waitlist"}
            </Button>

            <p className="text-xs text-[color:var(--ink-soft)]">
              We'll only use your details to contact you about MODO for hair & beauty. Unsubscribe any time.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
