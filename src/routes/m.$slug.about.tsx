import { createFileRoute } from "@tanstack/react-router";
import { getPractitionerBio } from "@/lib/practitioner-public.functions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Award } from "lucide-react";

export const Route = createFileRoute("/m/$slug/about")({
  loader: async ({ params }) => getPractitionerBio({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: `About ${loaderData?.profile.full_name ?? "practitioner"} · MODO` },
      { name: "description", content: loaderData?.profile.bio?.slice(0, 160) ?? "Meet your practitioner on MODO." },
    ],
  }),
  component: About,
});

type TimelineItem = { year: string; label: string };
type Qual = { label: string; year?: string };

function About() {
  const { profile } = Route.useLoaderData();
  const address = (profile.address as { line1?: string; city?: string; postcode?: string } | null) || {};
  const addressText = [address.line1, address.city, address.postcode].filter(Boolean).join(", ");
  const timeline = (profile.timeline as TimelineItem[] | null) ?? [];
  const quals = (profile.qualifications as Qual[] | null) ?? [];
  const specialties = profile.specialties ?? [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.full_name ?? ""} className="h-40 w-40 rounded-full object-cover" />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center rounded-full bg-muted text-4xl font-bold text-muted-foreground">
            {profile.full_name?.charAt(0) ?? "P"}
          </div>
        )}
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-3xl font-bold tracking-tight">{profile.full_name}</h1>
          {profile.tagline && <p className="mt-1 text-muted-foreground">{profile.tagline}</p>}
          {addressText && (
            <p className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />{addressText}
            </p>
          )}
        </div>
      </div>

      {profile.bio && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-semibold">Biography</h2>
          <p className="whitespace-pre-line leading-relaxed text-foreground/90">{profile.bio}</p>
        </section>
      )}

      {specialties.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-semibold">Specialties</h2>
          <div className="flex flex-wrap gap-2">
            {specialties.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
          </div>
        </section>
      )}

      {quals.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-semibold">Qualifications</h2>
          <ul className="space-y-2">
            {quals.map((q, i) => (
              <li key={i} className="flex items-start gap-2"><Award className="mt-0.5 h-4 w-4 text-primary" /><span><strong>{q.label}</strong>{q.year ? ` — ${q.year}` : ""}</span></li>
            ))}
          </ul>
        </section>
      )}

      {timeline.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold">Experience timeline</h2>
          <div className="space-y-4 border-l-2 border-primary/30 pl-6">
            {timeline.map((t, i) => (
              <Card key={i}>
                <CardContent className="py-4">
                  <div className="text-xs font-semibold uppercase text-primary">{t.year}</div>
                  <div className="mt-1">{t.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
