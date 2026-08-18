import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { listPublicCourses } from "@/lib/training-public.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  head: () => ({
    meta: [
      { title: "Aesthetics training courses" },
      { name: "description", content: "Hands-on aesthetics training courses with small group sizes, CPD hours and certification. View dates and book your place." },
      { property: "og:title", content: "Aesthetics training courses" },
      { property: "og:description", content: "Hands-on aesthetics training with small group sizes, CPD hours and certification." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrainingList,
});

const MODE_LABEL: Record<string, string> = {
  one_to_one: "1:1",
  group: "Group",
  multi_day: "Multi-day",
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

function Hero({ slug, count }: { slug: string; count: number }) {
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-accent/20 via-background to-background">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <Link to="/m/$slug" params={{ slug }} className="text-xs text-muted-foreground underline underline-offset-4">
          ← Back to clinic
        </Link>
        <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Academy
        </p>
        <h1 className="mt-2 max-w-2xl font-serif text-3xl leading-tight sm:text-5xl">
          Training courses taught by a practising clinician
        </h1>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
          Small cohorts, live models where applicable, and full aftercare guidance — so you leave
          confident, not just certified.
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

  return (
    <div>
      <Hero slug={slug} count={courses.length} />

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
            <h2 className="font-serif text-2xl sm:text-3xl">Available courses</h2>
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

        <section className="mt-14">
          <h2 className="font-serif text-2xl sm:text-3xl">What's included</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HIGHLIGHTS.map((h) => (
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

        <section className="mt-12 rounded-2xl border border-border/60 bg-gradient-to-br from-accent/15 via-card to-card p-6 sm:p-8">
          <h2 className="font-serif text-2xl">Not sure which course is right for you?</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Get in touch through the clinic page and we'll help you pick the course that matches your
            experience level and the treatments you want to offer.
          </p>
          <Link to="/m/$slug/about" params={{ slug }}>
            <Button variant="outline" className="mt-5">Contact the clinic</Button>
          </Link>
        </section>
      </div>
    </div>
  );
}

// Loading state
export function _pending() {
  return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
}
