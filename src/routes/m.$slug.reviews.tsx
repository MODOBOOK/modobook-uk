import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { getPractitionerReviews } from "@/lib/practitioner-public.functions";
import { submitPatientReview } from "@/lib/patient.functions";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/m/$slug/reviews")({
  loader: async ({ params }) => getPractitionerReviews({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: `Reviews · ${loaderData?.profile.clinic_name ?? "Clinic"} · MODO` },
      { name: "description", content: `Patient reviews for ${loaderData?.profile.clinic_name ?? "this clinic"}.` },
    ],
  }),
  component: Reviews,
});

function Stars({ value }: { value: number }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-4 w-4 ${n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

function Reviews() {
  const { patientReviews, testimonials, profile } = Route.useLoaderData();
  const { slug } = useParams({ from: "/m/$slug/reviews" });
  const submit = useServerFn(submitPatientReview);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  if (hasSession === null) {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }

  const allRatings = patientReviews.map((r) => r.rating).concat(testimonials.map((t) => t.rating ?? 5));
  const avg = allRatings.length ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return toast.error("Please write a review");
    setSaving(true);
    try {
      await submit({ data: { profileSlug: slug, rating, title: title || undefined, body } });
      toast.success("Thanks for your review!");
      setBody(""); setTitle(""); setRating(5);
      window.location.reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Patient reviews</h1>
        {allRatings.length > 0 && (
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            <Stars value={Math.round(avg)} />
            <span>{avg.toFixed(1)} · {allRatings.length} review{allRatings.length === 1 ? "" : "s"}</span>
          </div>
        )}
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Leave a review</h2>
        {hasSession ? (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">Rating:</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)}>
                  <Star className={`h-6 w-6 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                </button>
              ))}
            </div>
            <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="How was your experience?" value={body} onChange={(e) => setBody(e.target.value)} rows={4} required />
            <Button type="submit" disabled={saving}>{saving ? "Posting…" : "Post review"}</Button>
          </form>
        ) : (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <p>Sign in as a patient to leave a review.</p>
            <Link to="/m/$slug/auth" params={{ slug }} className="mt-2 inline-block"><Button size="sm">Sign in / sign up</Button></Link>
          </div>
        )}
      </section>

      <section className="space-y-4">
        {patientReviews.length === 0 && testimonials.length === 0 && (
          <p className="text-muted-foreground">No reviews yet. Be the first!</p>
        )}
        {patientReviews.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-2 py-4">
              <Stars value={r.rating} />
              {r.title && <h3 className="font-semibold">{r.title}</h3>}
              <p className="text-sm text-foreground/90">{r.body}</p>
              <p className="text-xs text-muted-foreground">Verified patient · {new Date(r.created_at).toLocaleDateString()}</p>
            </CardContent>
          </Card>
        ))}
        {testimonials.map((t) => (
          <Card key={t.id}>
            <CardContent className="space-y-2 py-4">
              {t.rating && <Stars value={t.rating} />}
              <p className="text-sm italic text-foreground/90">"{t.quote}"</p>
              <p className="text-xs text-muted-foreground">— {t.author_name}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
