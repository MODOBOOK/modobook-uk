import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { listPublicCourses } from "@/lib/training-public.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SafeHtml } from "@/components/SafeHtml";
import {
  GraduationCap,
  Award,
  Clock,
  Users,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Stethoscope,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/m/$slug/training")({
  loader: ({ params }) => listPublicCourses({ data: { slug: params.slug } }),
  head: ({ loaderData }) => {
    const page = (loaderData as { page?: TrainingPage | null } | undefined)?.page ?? null;
    const title = page?.seo_title || page?.headline || "Aesthetics training courses";
    const description =
      page?.seo_description ||
      page?.intro ||
      "Hands-on aesthetics training courses with small group sizes, CPD hours and certification. View dates and book your place.";
    const image = page?.hero_image_url;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image && image.startsWith("https://")
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
    };
  },
  component: TrainingList,
});

const MODE_LABEL: Record<string, string> = {
  one_to_one: "1:1",
  group: "Group",
  multi_day: "Multi-day",
};

export type TrainingPage = {
  eyebrow: string | null;
  headline: string | null;
  intro: string | null;
  hero_image_url: string | null;
  courses_heading: string | null;
  highlights: { title: string; body: string }[] | null;
  body_heading: string | null;
  body_html: string | null;
  show_highlights: boolean | null;
  show_cta: boolean | null;
  cta_heading: string | null;
  cta_body: string | null;
  cta_button_label: string | null;
  cta_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

type Course = {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  mode: string;
  duration_min: number;
  price: number | string;
  capacity: number | null;
  cpd_hours: number | string | null;
};

function Hero({ slug, count, page }: { slug: string; count: number; page: TrainingPage | null }) {
  const heroImage = page?.hero_image_url ?? null;
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-accent/20 via-background to-background">
      {heroImage && (
        <>
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />
        </>
      )}
      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <Link to="/m/$slug" params={{ slug }} className="text-xs text-muted-foreground underline underline-offset-4">
          ← Back to clinic
        </Link>
        <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
          {page?.eyebrow || "Academy"}
        </p>
        <h1 className="mt-2 max-w-2xl font-serif text-3xl leading-tight sm:text-5xl">
          {page?.headline || "Training courses taught by a practising clinician"}
        </h1>
        <p className="mt-4 max-w-xl whitespace-pre-line text-sm text-muted-foreground sm:text-base">
          {page?.intro ||
            "Small cohorts, live models where applicable, and full aftercare guidance — so you leave confident, not just certified."}
        </p>
        {count > 0 && (
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
            <GraduationCap className="h-3.5 w-3.5" />
            {count} course{count === 1 ? "" : "s"} currently open for booking
          </p>
        )}
      </div>
    </section>
  );
}

const HIGHLIGHTS = [
  { icon: Users, title: "Small groups", body: "Limited places so you get genuine hands-on time and personal feedback." },
  { icon: Stethoscope, title: "Clinical standard", body: "Anatomy, consultation, complication management and aftercare — not just technique." },
  { icon: ShieldCheck, title: "Certified & insurable", body: "Certificates issued on completion, with CPD hours where listed." },
  { icon: Sparkles, title: "Ongoing support", body: "Post-course guidance as you start treating your own clients." },
];

function TrainingList() {
  const { slug } = useParams({ from: "/m/$slug/training" });
  const data = Route.useLoaderData();
  const courses = (data.courses ?? []) as Course[];
  const page = ((data as { page?: TrainingPage | null }).page ?? null) as TrainingPage | null;
  const highlights =
    page?.highlights && page.highlights.length > 0
      ? page.highlights.map((h) => ({ icon: Sparkles, title: h.title, body: h.body }))
      : HIGHLIGHTS;

  return (
    <div>
      <Hero slug={slug} count={courses.length} page={page} />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-12">
        {courses.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-10 text-center">
            <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h2 className="font-serif text-2xl">No courses open right now</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              New dates are released regularly — please check back soon.
            </p>
            <Link to="/m/$slug" params={{ slug }}>
              <Button variant="outline" className="mt-6">Back to clinic</Button>
            </Link>
          </div>
        ) : (
          <>
            <h2 className="font-serif text-2xl sm:text-3xl">{page?.courses_heading || "Available courses"}</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {courses.map((c) => (
                <Card
                  key={c.id}
                  className="group flex flex-col overflow-hidden border-border/60 transition hover:border-accent hover:shadow-luxe"
                >
                  <div className="flex gap-4 p-4">
                    {c.cover_image_url ? (
                      <img
                        src={c.cover_image_url}
                        alt={c.name}
                        loading="lazy"
                        className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-border/60 sm:h-24 sm:w-24"
                      />
                    ) : (
                      <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-border/60 sm:h-24 sm:w-24">
                        <GraduationCap className="h-7 w-7" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-serif text-lg leading-snug">{c.name}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">{MODE_LABEL[c.mode] ?? c.mode}</Badge>
                        {c.cpd_hours != null && (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <Award className="h-3 w-3" /> {c.cpd_hours} CPD
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 font-serif text-lg">£{Number(c.price).toFixed(2)}</p>
                    </div>
                  </div>

                  <CardContent className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-0">
                    {c.description && (
                      <p className="line-clamp-3 text-sm text-muted-foreground">{c.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {c.duration_min} min
                      </span>
                      {c.capacity && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" /> up to {c.capacity} trainees
                        </span>
                      )}
                    </div>
                    <Link
                      to="/m/$slug/training/$courseId"
                      params={{ slug, courseId: c.id }}
                      className="mt-auto"
                    >
                      <Button className="w-full">
                        View dates & book <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {page?.body_html && (
          <section className="mt-14">
            {page.body_heading && (
              <h2 className="font-serif text-2xl sm:text-3xl">{page.body_heading}</h2>
            )}
            <SafeHtml
              html={page.body_html}
              className="prose prose-sm mt-4 max-w-3xl text-muted-foreground dark:prose-invert"
            />
          </section>
        )}

        {page?.show_highlights !== false && (
        <section className="mt-14">
          <h2 className="font-serif text-2xl sm:text-3xl">What's included</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map((h) => (
              <div key={h.title} className="rounded-2xl border border-border/60 bg-card p-5">
                <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <h.icon className="size-5" />
                </div>
                <h3 className="mt-3 font-medium">{h.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{h.body}</p>
              </div>
            ))}
          </div>
        </section>
        )}

        {page?.show_cta !== false && (
        <section className="mt-12 rounded-2xl border border-border/60 bg-gradient-to-br from-accent/15 via-card to-card p-6 sm:p-8">
          <h2 className="font-serif text-2xl">
            {page?.cta_heading || "Not sure which course is right for you?"}
          </h2>
          <p className="mt-2 max-w-xl whitespace-pre-line text-sm text-muted-foreground">
            {page?.cta_body ||
              "Get in touch through the clinic page and we'll help you pick the course that matches your experience level and the treatments you want to offer."}
          </p>
          {page?.cta_url ? (
            <a href={page.cta_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="mt-5">
                {page.cta_button_label || "Get in touch"}
              </Button>
            </a>
          ) : (
            <Link to="/m/$slug/about" params={{ slug }}>
              <Button variant="outline" className="mt-5">
                {page?.cta_button_label || "Contact the clinic"}
              </Button>
            </Link>
          )}
        </section>
        )}
      </div>
    </div>
  );
}

// Loading state
export function _pending() {
  return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
}
