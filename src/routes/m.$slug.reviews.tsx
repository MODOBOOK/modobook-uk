import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { getPractitionerReviews } from "@/lib/practitioner-public.functions";
import { submitPublicReview } from "@/lib/patient.functions";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/m/$slug/reviews")({
  loader: async ({ params }) => getPractitionerReviews({ data: { slug: params.slug } }),
  head: ({ params, loaderData }) => {
    const clinic = loaderData?.profile.clinic_name ?? "Clinic";
    const reviews = loaderData?.patientReviews ?? [];
    const count = reviews.length;
    const avg = count
      ? Math.round((reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / count) * 10) / 10
      : 0;
    return {
      meta: [
        { title: `Reviews · ${clinic} · MODO` },
        { name: "description", content: `Patient reviews for ${clinic}.` },
        { property: "og:title", content: `Reviews · ${clinic}` },
        { property: "og:description", content: `Patient reviews for ${clinic}.` },
        { property: "og:url", content: `https://modobook.uk/m/${params.slug}/reviews` },
      ],
      links: [{ rel: "canonical", href: `https://modobook.uk/m/${params.slug}/reviews` }],
      scripts: count
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "LocalBusiness",
                name: clinic,
                url: `https://modobook.uk/m/${params.slug}`,
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: avg,
                  reviewCount: count,
                  bestRating: 5,
                },
              }),
            },
          ]
        : undefined,
    };
  },
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
  const { patientReviews, testimonials } = Route.useLoaderData();
  const { slug } = useParams({ from: "/m/$slug/reviews" });
  const submit = useServerFn(submitPublicReview);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const allRatings: number[] = patientReviews.map((r: { rating: number }) => r.rating).concat(testimonials.map((t: { rating: number | null }) => t.rating ?? 5));
  const avg = allRatings.length ? allRatings.reduce((a: number, b: number) => a + b, 0) / allRatings.length : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Please enter your name");
    if (!body.trim()) return toast.error("Please write a review");
    setSaving(true);
    try {
      await submit({ data: { profileSlug: slug, rating, title: title || undefined, body, reviewerName: name, reviewerEmail: email || undefined } });
      toast.success("Thanks! Your review has been sent for approval.");
      setBody(""); setTitle(""); setRating(5); setName(""); setEmail("");
      setSubmitted(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--brand)", fontFamily: "var(--heading-font)" }}>Patient reviews</h1>
        {allRatings.length > 0 && (
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            <Stars value={Math.round(avg)} />
            <span>{avg.toFixed(1)} · {allRatings.length} review{allRatings.length === 1 ? "" : "s"}</span>
          </div>
        )}
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--brand)", fontFamily: "var(--heading-font)" }}>Leave a review</h2>
        {submitted ? (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <p>Thank you — your review has been submitted and will appear once approved.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setSubmitted(false)}>Leave another</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">Rating:</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)}>
                  <Star className={`h-6 w-6 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                </button>
              ))}
            </div>
            <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
            <Input type="email" placeholder="Email (optional, not shown)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="How was your experience?" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000} required />
            <p className="text-xs text-muted-foreground">Reviews appear after the clinic approves them.</p>
            <Button type="submit" disabled={saving}>{saving ? "Posting…" : "Post review"}</Button>
          </form>
        )}
      </section>

      <section className="space-y-4">
        {patientReviews.length === 0 && testimonials.length === 0 && (
          <p className="text-muted-foreground">No reviews yet. Be the first!</p>
        )}
        {patientReviews.map((r: { id: string; rating: number; title: string | null; body: string; created_at: string; reviewer_name?: string | null }) => (
          <Card key={r.id}>
            <CardContent className="space-y-2 py-4">
              <Stars value={r.rating} />
              {r.title && <h3 className="font-semibold">{r.title}</h3>}
              <p className="text-sm text-foreground/90">{r.body}</p>
              <p className="text-xs text-muted-foreground">{r.reviewer_name ?? "Patient"} · {new Date(r.created_at).toLocaleDateString()}</p>
            </CardContent>
          </Card>
        ))}
        {testimonials.map((t: { id: string; rating: number | null; quote: string; author_name: string }) => (
          <Card key={t.id}>
            <CardContent className="space-y-2 py-4">
              {t.rating && <Stars value={t.rating} />}
              {t.quote?.trim() && <p className="text-sm italic text-foreground/90">"{t.quote}"</p>}
              <p className="text-xs text-muted-foreground">— {t.author_name}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
