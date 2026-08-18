import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listPublicCourses } from "@/lib/training-public.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Award, Clock, Users, ArrowRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/m/$slug/training")({
  loader: ({ params }) => listPublicCourses({ data: { slug: params.slug } }),
  head: () => ({
    meta: [
      { title: "Aesthetics training courses" },
      { name: "description", content: "Book aesthetics training courses with this clinic." },
      { property: "og:title", content: "Aesthetics training courses" },
      { property: "og:description", content: "Book aesthetics training courses with this clinic." },
    ],
  }),
  component: TrainingList,
});

const MODE_LABEL: Record<string, string> = {
  one_to_one: "1:1",
  group: "Group",
  multi_day: "Multi-day",
};

function TrainingList() {
  const { slug } = useParams({ from: "/m/$slug/training" });
  const data = Route.useLoaderData();
  const courses = data.courses as Array<{
    id: string; name: string; description: string | null; cover_image_url: string | null;
    mode: string; duration_min: number; price: number | string;
    capacity: number | null; cpd_hours: number | string | null;
  }>;

  if (!courses.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h1 className="text-2xl font-serif">No training courses right now</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please check back soon.</p>
        <Link to="/m/$slug" params={{ slug }}><Button variant="outline" className="mt-6">Back to clinic</Button></Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <Link to="/m/$slug" params={{ slug }} className="text-xs text-muted-foreground underline underline-offset-4">
          ← Back to clinic
        </Link>
        <h1 className="mt-3 flex items-center gap-2 font-serif text-3xl">
          <GraduationCap className="h-7 w-7" /> Training courses
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Learn from the practitioner directly. Pick a course to see dates and book your place.
        </p>
      </div>

      <div className="grid gap-4">
        {courses.map((c) => (
          <Card key={c.id} className="overflow-hidden">
            {c.cover_image_url && (
              <img src={c.cover_image_url} alt={c.name} className="h-40 w-full object-cover" />
            )}
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-xl">{c.name}</h2>
                <Badge variant="outline">{MODE_LABEL[c.mode] ?? c.mode}</Badge>
                {c.cpd_hours != null && (
                  <Badge variant="outline" className="gap-1"><Award className="h-3 w-3" /> {c.cpd_hours} CPD hours</Badge>
                )}
              </div>
              {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {c.duration_min} min</span>
                {c.capacity && (
                  <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> up to {c.capacity} trainees</span>
                )}
                <span className="font-semibold text-foreground">£{Number(c.price).toFixed(2)}</span>
              </div>
              <Link to="/m/$slug/training/$courseId" params={{ slug, courseId: c.id }}>
                <Button>Book this course <ArrowRight className="ml-1 h-4 w-4" /></Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Loading state
export function _pending() {
  return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
}
