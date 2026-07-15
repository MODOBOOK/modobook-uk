import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicCourse, createTrainingBooking } from "@/lib/training-public.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Award, Clock, Users, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/m/$slug/training/$courseId")({
  validateSearch: (s: Record<string, unknown>) => ({ preview: typeof s.preview === "string" ? s.preview : undefined }),
  loaderDeps: ({ search }) => ({ preview: search.preview ?? null }),
  loader: ({ params, deps }) => getPublicCourse({ data: { slug: params.slug, courseId: params.courseId, previewToken: deps.preview } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.course.name ?? "Training"} · Book training` },
      { name: "description", content: loaderData?.course.description ?? "Book aesthetics training." },
    ],
  }),
  component: BookCoursePage,
});

function BookCoursePage() {
  const { slug } = useParams({ from: "/m/$slug/training/$courseId" });
  const data = Route.useLoaderData();
  type Session = { id: string; session_date: string; start_time: string; end_time: string; location_id: string | null };
  type Loc = { id: string; name: string; address_line1: string | null; address_line2: string | null; city: string | null; postcode: string | null; country: string | null };
  const course = data.course as {
    id: string; name: string; description: string | null; mode: string;
    duration_min: number; price: number | string; capacity: number | null;
    cpd_hours: number | string | null; prerequisites: string | null;
    require_prereq_confirm: boolean;
  };
  const sessions = data.sessions as Session[];
  const bookingsBySession = data.bookingsBySession as Record<string, number>;
  const locations = data.locations as Loc[];
  const bookFn = useServerFn(createTrainingBooking);
  const bookable = (data as { bookable?: boolean }).bookable !== false;

  const isSchedule = course.mode === "group" || course.mode === "multi_day";
  const [sessionId, setSessionId] = useState<string | null>(sessions[0]?.id ?? null);
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredStart, setPreferredStart] = useState("");
  const [locationId, setLocationId] = useState<string | null>(locations[0]?.id ?? null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [prereq, setPrereq] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!name.trim() || !email.trim()) {
      toast.error("Please add your name and email"); return;
    }
    if (isSchedule && !sessionId) { toast.error("Please pick a date"); return; }
    if (!isSchedule && !preferredDate) { toast.error("Please choose a preferred date"); return; }
    if (course.require_prereq_confirm && !prereq) {
      toast.error("Please confirm you meet the prerequisites"); return;
    }
    setSubmitting(true);
    try {
      await bookFn({
        data: {
          course_id: course.id,
          session_id: isSchedule ? sessionId : null,
          trainee_name: name,
          trainee_email: email,
          trainee_phone: phone,
          prereq_confirmed: prereq,
          preferred_date: !isSchedule ? preferredDate : undefined,
          preferred_start: !isSchedule ? (preferredStart ? `${preferredStart}:00` : undefined) : undefined,
          location_id: locationId,
          notes,
        },
      });
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to book");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-12 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h1 className="font-serif text-2xl">Booking request sent</h1>
        <p className="text-sm text-muted-foreground">
          Thanks {name.split(" ")[0]} — the practitioner will confirm your place shortly and email you the details.
        </p>
        <Link to="/m/$slug" params={{ slug }}>
          <Button variant="outline">Back to clinic</Button>
        </Link>
      </div>
    );
  }

  const locById = new Map(locations.map((l) => [l.id, l]));

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Link to="/m/$slug/training" params={{ slug }}>
        <Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" /> All courses</Button>
      </Link>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h1 className="font-serif text-2xl">{course.name}</h1>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline"><Clock className="mr-1 h-3 w-3" /> {course.duration_min} min</Badge>
            {course.capacity && <Badge variant="outline"><Users className="mr-1 h-3 w-3" /> up to {course.capacity}</Badge>}
            {course.cpd_hours != null && <Badge variant="outline"><Award className="mr-1 h-3 w-3" /> {course.cpd_hours} CPD</Badge>}
            <Badge>£{Number(course.price).toFixed(2)}</Badge>
          </div>
          {course.description && <p className="text-sm text-muted-foreground">{course.description}</p>}
        </CardContent>
      </Card>

      {course.prerequisites && (
        <Card>
          <CardHeader><CardTitle className="text-base">Prerequisites</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-line text-sm text-muted-foreground">{course.prerequisites}</p></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Pick your date</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isSchedule ? (
            sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming dates. Please check back soon.</p>
            ) : (
              <div className="grid gap-2">
                {sessions.map((s) => {
                  const booked = bookingsBySession[s.id] ?? 0;
                  const full = !!course.capacity && booked >= course.capacity;
                  const loc = s.location_id ? locById.get(s.location_id) : null;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={full}
                      onClick={() => setSessionId(s.id)}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-left text-sm ${sessionId === s.id ? "border-primary bg-primary/5" : ""} ${full ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50"}`}
                    >
                      <div>
                        <div className="font-medium">
                          {new Date(s.session_date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                          {loc ? ` · ${loc.name}` : ""}
                        </div>
                      </div>
                      {full ? (
                        <Badge variant="secondary">Full</Badge>
                      ) : course.capacity ? (
                        <Badge variant="outline">{course.capacity - booked} seat{course.capacity - booked === 1 ? "" : "s"} left</Badge>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preferred date</Label>
                <Input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
              </div>
              <div>
                <Label>Preferred time</Label>
                <Input type="time" value={preferredStart} onChange={(e) => setPreferredStart(e.target.value)} />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                The practitioner will confirm a slot from their availability and email you.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Your details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Phone (optional)</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Anything the practitioner should know?</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {course.require_prereq_confirm && (
            <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <Checkbox checked={prereq} onCheckedChange={(v) => setPrereq(!!v)} />
              <span>I confirm I meet the prerequisites listed above.</span>
            </label>
          )}
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" onClick={submit} disabled={submitting || !bookable}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : bookable ? "Send booking request" : "Coming soon"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {bookable
          ? "The practitioner will confirm and follow up with payment details."
          : "This course isn't open for bookings yet — check back soon."}
      </p>
    </div>
  );
}
