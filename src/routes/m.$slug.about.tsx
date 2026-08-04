import { createFileRoute } from "@tanstack/react-router";
import { getPractitionerBio } from "@/lib/practitioner-public.functions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Award, Clock, Sparkles, MessageCircle, ShieldCheck, HeartHandshake } from "lucide-react";
import { resolveDisplayNames } from "@/lib/display-name";


export const Route = createFileRoute("/m/$slug/about")({
  loader: async ({ params }) => getPractitionerBio({ data: { slug: params.slug } }),
  head: ({ params, loaderData }) => {
    const name = loaderData?.profile ? resolveDisplayNames(loaderData.profile).primary : "practitioner";
    const description = (loaderData?.profile.bio ?? "").slice(0, 160) || "Meet your practitioner on MODO.";
    return {
      meta: [
        { title: `About ${name} · MODO` },
        { name: "description", content: description },
        { property: "og:title", content: `About ${name}` },
        { property: "og:description", content: description },
        { property: "og:url", content: `https://modobook.uk/m/${params.slug}/about` },
      ],
      links: [{ rel: "canonical", href: `https://modobook.uk/m/${params.slug}/about` }],
    };
  },

  component: About,
});

type TimelineItem = { year: string; label: string };
type Qual = { label: string; year?: string };
type FAQ = { q: string; a: string };
type Hours = { day: string; hours: string };
type LocationRow = {
  id: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  is_primary: boolean | null;
  image_url: string | null;
};

type AboutPage = {
  show_bio?: boolean;
  show_intro?: boolean;
  show_mission?: boolean;
  show_why_choose?: boolean;
  show_what_to_expect?: boolean;
  show_specialties?: boolean;
  show_qualifications?: boolean;
  show_timeline?: boolean;
  show_locations?: boolean;
  show_opening_hours?: boolean;
  show_faqs?: boolean;
  show_contact?: boolean;
  show_hero_image?: boolean;
  hero_image_url?: string;
  intro_heading?: string;
  intro_body?: string;
  mission?: string;
  why_choose?: string[];
  what_to_expect?: string;
  opening_hours?: Hours[];
  faqs?: FAQ[];
  contact_email?: string;
  contact_phone?: string;
  contact_extra?: string;
};

function fullAddress(l: LocationRow) {
  return [l.address_line1, l.address_line2, l.city, l.postcode, l.country].filter(Boolean).join(", ");
}

function About() {
  const { profile, aboutPage, locations } = Route.useLoaderData();
  const ap = (aboutPage as unknown as AboutPage) ?? {};
  const show = (k: keyof AboutPage, def = true) => (ap[k] === undefined ? def : Boolean(ap[k]));

  const heroImage = ap.hero_image_url || profile.hero_url;
  const displayName = profile.clinic_name || profile.full_name;
  const quals = (profile.qualifications as Qual[] | null) ?? [];
  const timeline = (profile.timeline as TimelineItem[] | null) ?? [];
  const specialties = profile.specialties ?? [];
  const whyChoose = ap.why_choose ?? [];
  const hours = ap.opening_hours ?? [];
  const faqs = ap.faqs ?? [];
  const locs = (locations as LocationRow[]) ?? [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      {/* Hero */}
      {show("show_hero_image", true) && heroImage && (
        <div className="mb-10 overflow-hidden rounded-3xl shadow-sm ring-1 ring-black/5">
          <img src={heroImage} alt="" className="h-56 w-full object-cover sm:h-80" />
        </div>
      )}

      <header className="flex flex-col items-center gap-6 rounded-3xl border bg-card p-6 text-center shadow-sm sm:flex-row sm:items-center sm:p-8 sm:text-left">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={displayName ?? ""}
            className="h-32 w-32 shrink-0 rounded-full object-cover ring-4 ring-[color:var(--brand)]/15 sm:h-40 sm:w-40"
          />
        ) : (
          <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-muted text-4xl font-bold text-muted-foreground sm:h-40 sm:w-40">
            {displayName?.charAt(0) ?? "P"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">About</p>
          <h1
            className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ color: "var(--brand)", fontFamily: "var(--heading-font)" }}
          >
            {displayName}
          </h1>
          {profile.full_name && profile.clinic_name && profile.full_name !== profile.clinic_name && (
            <p className="mt-1 text-base text-muted-foreground">{profile.full_name}</p>
          )}
          {profile.tagline && <p className="mt-3 text-muted-foreground">{profile.tagline}</p>}
        </div>
      </header>


      {/* Intro */}
      {show("show_intro", true) && (ap.intro_heading || ap.intro_body) && (
        <section className="mt-8 rounded-3xl border bg-gradient-to-br from-[color:var(--brand)]/10 to-transparent p-6 shadow-sm sm:p-8">
          {ap.intro_heading && (
            <h2 className="text-2xl font-semibold" style={{ color: "var(--brand)", fontFamily: "var(--heading-font)" }}>
              {ap.intro_heading}
            </h2>
          )}
          {ap.intro_body && <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground/90">{ap.intro_body}</p>}
        </section>
      )}




      {/* Mission */}
      {show("show_mission", false) && ap.mission && (
        <Section icon={HeartHandshake} title="My approach">
          <p className="whitespace-pre-line leading-relaxed text-foreground/90">{ap.mission}</p>
        </Section>
      )}

      {/* Why choose me */}
      {show("show_why_choose", false) && whyChoose.length > 0 && (
        <Section icon={ShieldCheck} title="Why choose us">
          <ul className="grid gap-3 sm:grid-cols-2">
            {whyChoose.map((w, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border bg-card p-4 text-sm">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* What to expect */}
      {show("show_what_to_expect", false) && ap.what_to_expect && (
        <Section icon={MessageCircle} title="What to expect">
          <p className="whitespace-pre-line leading-relaxed text-foreground/90">{ap.what_to_expect}</p>
        </Section>
      )}

      {/* Specialties */}
      {show("show_specialties", true) && specialties.length > 0 && (
        <Section title="Specialties">
          <div className="flex flex-wrap gap-2">
            {specialties.map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
          </div>
        </Section>
      )}

      {/* Qualifications */}
      {show("show_qualifications", true) && quals.length > 0 && (
        <Section icon={Award} title="Qualifications">
          <ul className="space-y-2">
            {quals.map((q, i) => (
              <li key={i} className="flex items-start gap-2">
                <Award className="mt-0.5 h-4 w-4 text-[var(--brand)]" />
                <span><strong>{q.label}</strong>{q.year ? ` — ${q.year}` : ""}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Locations */}
      {show("show_locations", true) && locs.length > 0 && (
        <Section icon={MapPin} title={locs.length > 1 ? "Our locations" : "Find us"}>
          <div className="grid gap-3 sm:grid-cols-2">
            {locs.map((l) => {
              const addr = fullAddress(l);
              return (
                <div key={l.id} className="overflow-hidden rounded-lg border bg-card">
                  {l.image_url && <img src={l.image_url} alt="" className="h-32 w-full object-cover" />}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{l.name}</p>
                      {l.is_primary && <Badge variant="outline" className="text-xs">Main</Badge>}
                    </div>
                    {addr && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block text-sm text-muted-foreground hover:underline"
                      >
                        {addr}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Opening hours */}
      {show("show_opening_hours", false) && hours.length > 0 && (
        <Section icon={Clock} title="Opening hours">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <tbody>
                {hours.map((h, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="bg-muted/40 px-4 py-2 font-medium">{h.day}</td>
                    <td className="px-4 py-2">{h.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Timeline */}
      {show("show_timeline", true) && timeline.length > 0 && (
        <Section title="Experience timeline">
          <div className="space-y-4 border-l-2 border-[color:var(--brand)]/30 pl-6">
            {timeline.map((t, i) => (
              <Card key={i}>
                <CardContent className="py-4">
                  <div className="text-xs font-semibold uppercase text-[var(--brand)]">{t.year}</div>
                  <div className="mt-1">{t.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {/* FAQs */}
      {show("show_faqs", false) && faqs.length > 0 && (
        <Section title="Frequently asked">
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="rounded-lg border bg-card p-4">
                <p className="font-semibold">{f.q}</p>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Contact */}
      {show("show_contact", false) && (ap.contact_email || ap.contact_phone || ap.contact_extra) && (
        <Section icon={MessageCircle} title="Get in touch">
          <div className="space-y-2 text-sm">
            {ap.contact_email && <p>Email: <a href={`mailto:${ap.contact_email}`} className="underline">{ap.contact_email}</a></p>}
            {ap.contact_phone && <p>Phone: <a href={`tel:${ap.contact_phone}`} className="underline">{ap.contact_phone}</a></p>}
            {ap.contact_extra && <p className="whitespace-pre-line text-muted-foreground">{ap.contact_extra}</p>}
          </div>
        </Section>
      )}
    </main>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-5 flex items-center gap-3">
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand)]/10 text-[var(--brand)]">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <h2
          className="text-xl font-semibold tracking-tight sm:text-2xl"
          style={{ color: "var(--brand)", fontFamily: "var(--heading-font)" }}
        >
          {title}
        </h2>
      </div>
      <div className="text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}
