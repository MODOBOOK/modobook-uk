import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyPatient,
  getMyPatientLinks,
  ensurePatient,
  getMyAppointments,
  submitPatientReview,
} from "@/lib/patient.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Calendar as CalendarIcon, Clock, MapPin, Star, FileText } from "lucide-react";
import { toast } from "sonner";

type Appt = {
  id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  status: string | null;
  payment_status: string | null;
  total_amount: number | null;
  notes: string | null;
  practitioner_notes: string | null;
  treatment: { name: string | null; duration: number | null } | null;
  location: { name: string | null; address_line1: string | null; city: string | null } | null;
  profile: { slug: string | null; clinic_name: string | null; full_name: string | null } | null;
};

export const Route = createFileRoute("/m/$slug/account")({
  ssr: false,
  component: Account,
});

function Account() {
  const { slug } = useParams({ from: "/m/$slug/account" });
  const navigate = useNavigate();
  const getPatient = useServerFn(getMyPatient);
  const getLinks = useServerFn(getMyPatientLinks);
  const getAppts = useServerFn(getMyAppointments);
  const ensure = useServerFn(ensurePatient);
  const submitReview = useServerFn(submitPatientReview);

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<{ full_name: string; email: string | null } | null>(null);
  const [links, setLinks] = useState<Array<{ profiles: { slug: string; clinic_name: string | null; full_name: string | null } | null }>>([]);
  const [appts, setAppts] = useState<Appt[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({ to: "/m/$slug/auth", params: { slug }, search: { redirect: `/m/${slug}/account` } });
        return;
      }
      const p = await getPatient();
      if (!p.patient) {
        await ensure({ data: { fullName: data.session.user.email?.split("@")[0] ?? "Patient", linkSlug: slug } });
      } else {
        setPatient(p.patient);
      }
      const [l, a] = await Promise.all([getLinks(), getAppts()]);
      setLinks(l.links as typeof links);
      setAppts(a.appointments as Appt[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = appts.filter((a) => a.scheduled_date >= today);
  const past = appts.filter((a) => a.scheduled_date < today);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">My MODO Book account</h1>
      <p className="mt-1 text-muted-foreground">Welcome back{patient?.full_name ? `, ${patient.full_name}` : ""}.</p>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2"><CalendarIcon className="h-4 w-4" />Upcoming appointments</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
        ) : (
          <div className="space-y-3">{upcoming.map((a) => <ApptCard key={a.id} a={a} />)}</div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold flex items-center gap-2"><FileText className="h-4 w-4" />Past appointments &amp; notes</h2>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">No past appointments yet.</p>
        ) : (
          <div className="space-y-3">
            {past.map((a) => (
              <ApptCard key={a.id} a={a} showReview onReview={async (rating, body) => {
                if (!a.profile?.slug) return;
                try {
                  await submitReview({ data: { profileSlug: a.profile.slug, rating, body } });
                  toast.success("Review submitted — thank you!");
                } catch (e) { toast.error((e as Error).message); }
              }} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Your practitioners</h2>
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">No practitioners linked yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {links.map((l, i) => l.profiles && (
              <Card key={i}>
                <CardHeader><CardTitle className="text-base">{l.profiles.clinic_name}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">{l.profiles.full_name}</p>
                  <Link to="/m/$slug" params={{ slug: l.profiles.slug }}>
                    <Button size="sm" variant="outline">Visit clinic</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="mt-10">
        <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/m/$slug", params: { slug } }); }}>
          Sign out
        </Button>
      </div>
    </main>
  );
}

function ApptCard({ a, showReview, onReview }: { a: Appt; showReview?: boolean; onReview?: (rating: number, body: string) => Promise<void> }) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span>{a.treatment?.name ?? "Treatment"}</span>
          <Badge variant={a.status === "confirmed" ? "default" : "secondary"}>{a.status ?? "pending"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" />{a.scheduled_date}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{a.start_time?.slice(0,5)}–{a.end_time?.slice(0,5)}</span>
          {a.location?.name && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{a.location.name}</span>}
        </div>
        {a.profile?.clinic_name && <div className="text-xs text-muted-foreground">{a.profile.clinic_name}</div>}
        {a.practitioner_notes && (
          <div className="rounded-md border bg-muted/30 p-2 text-xs">
            <div className="font-semibold mb-1">Practitioner notes</div>
            <div className="whitespace-pre-wrap">{a.practitioner_notes}</div>
          </div>
        )}
        {showReview && onReview && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="mt-2"><Star className="h-3.5 w-3.5 mr-1" />Leave a review</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Review {a.profile?.clinic_name ?? "your practitioner"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Rating</Label>
                  <Input type="number" min={1} max={5} value={rating} onChange={(e) => setRating(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Your review</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={async () => { await onReview(rating, body); setOpen(false); setBody(""); }}>Submit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
