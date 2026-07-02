import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2, Calendar as CalendarIcon, Clock, MapPin, FileText, StickyNote,
  ClipboardCheck, Receipt, ShieldCheck, ExternalLink, Sparkles, HeartPulse,
  Mail, Phone, AlertTriangle, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { describeCancellationRules, type CancellationRule } from "@/lib/policy";

export const Route = createFileRoute("/m/$slug/account")({
  ssr: false,
  component: Account,
});

type Appt = {
  id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  status: string | null;
  payment_status: string | null;
  total_amount: number | null;
  treatment_id: string | null;
  reschedule_count: number | null;
  treatment_name_snapshot: string | null;
  treatments: { name: string | null } | null;
  locations: { name: string | null } | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  clinic_name: string | null;
  brand_color: string | null;
  avatar_url: string | null;
  allow_patient_cancel: boolean | null;
  allow_patient_reschedule: boolean | null;
  cancellation_rules: any;
  patient_cancel_cutoff_hours: number | null;
  patient_reschedule_cutoff_hours: number | null;
  patient_reschedule_max: number | null;
  late_cancel_mode: "block" | "warn_agree" | null;
  email: string | null;
  phone: string | null;
  contact_sms_number: string | null;
  contact_whatsapp_number: string | null;
};

function Account() {
  const { slug } = useParams({ from: "/m/$slug/account" });
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [patientName, setPatientName] = useState<string>("");
  const [appts, setAppts] = useState<Appt[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [aftercare, setAftercare] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [cancelTarget, setCancelTarget] = useState<Appt | null>(null);
  const [cancelAgreed, setCancelAgreed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimEmail, setClaimEmail] = useState("");
  const [claiming, setClaiming] = useState(false);

  async function claimBookings() {
    if (!claimEmail.trim()) return;
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_appointments_by_email", {
      p_slug: slug, p_email: claimEmail.trim(),
    } as any);
    setClaiming(false);
    if (error) return toast.error(error.message);
    const n = Number(data ?? 0);
    if (n === 0) {
      toast.info("No bookings found for that email at this clinic.");
    } else {
      toast.success(`Linked ${n} booking${n === 1 ? "" : "s"} to your account.`);
      setClaimOpen(false); setClaimEmail("");
      loadAll();
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/m/$slug/auth", params: { slug }, search: { redirect: `/m/${slug}/account` } });
        return;
      }

      // Link account to THIS practitioner (idempotent)
      const { error: linkErr } = await supabase.rpc("link_patient_account", { p_slug: slug });
      if (linkErr) throw linkErr;

      // Public profile + rules
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name, clinic_name, brand_color, avatar_url, allow_patient_cancel, allow_patient_reschedule, cancellation_rules, patient_cancel_cutoff_hours, patient_reschedule_cutoff_hours, patient_reschedule_max, late_cancel_mode, email, phone, contact_sms_number, contact_whatsapp_number")
        .eq("slug", slug)
        .maybeSingle();
      if (!prof) throw new Error("Practitioner not found");
      setProfile(prof as Profile);

      // Linked clinic_client (RLS-scoped to me)
      const { data: client } = await supabase
        .from("clinic_clients")
        .select("id, full_name")
        .eq("profile_id", prof.id)
        .maybeSingle();
      setPatientName(client?.full_name ?? sess.session.user.email?.split("@")[0] ?? "");

      // Appointments — exclude "pending" placeholders that haven't been paid yet.
      // These are Stripe checkout holds; until Stripe confirms payment the
      // appointment shouldn't appear on the patient's account.
      
      const { data: apptRows } = await supabase
        .from("appointments")
        .select("id, scheduled_date, start_time, end_time, status, payment_status, amount_paid_cents, payment_hold_expires_at, total_amount, treatment_id, reschedule_count, treatment_name_snapshot, treatments(name), locations(name)")
        .eq("profile_id", prof.id)
        .order("scheduled_date", { ascending: false });
      const visibleAppts = (apptRows ?? []).filter((a: any) => {
        // Always show confirmed/completed/cancelled — those have real state.
        if (a.status !== "pending") return true;
        // Pending + paid (or partial deposit) is a real booking.
        if (a.payment_status === "paid" || (a.amount_paid_cents ?? 0) > 0) return true;
        // Pending + unpaid inside the hold window: not confirmed yet, hide.
        // Pending + unpaid past the hold window: abandoned, hide.
        if (!a.payment_hold_expires_at) return true; // legacy row with no hold — leave visible
        return false;
      });
      setAppts(visibleAppts as any);


      const apptIds = (apptRows ?? []).map((a) => a.id);

      // Medical forms (including stand-alone ones sent via send_medical_form_to_client)
      const { data: formRows } = await supabase
        .from("appointment_medical_forms")
        .select("id, token, status, submitted_at, created_at, appointment_id, medical_form_templates(name)")
        .eq("profile_id", prof.id)
        .order("created_at", { ascending: false });
      setForms((formRows ?? []) as any);

      // Consent forms
      if (apptIds.length) {
        const { data: consRows } = await supabase
          .from("appointment_consents")
          .select("id, token, status, signed_at, created_at, appointment_id, consent_templates(name)")
          .in("appointment_id", apptIds)
          .order("created_at", { ascending: false });
        setConsents((consRows ?? []) as any);

        const { data: payRows } = await supabase
          .from("payments")
          .select("id, amount, currency, status, created_at, appointment_id")
          .in("appointment_id", apptIds)
          .order("created_at", { ascending: false });
        setPayments((payRows ?? []) as any);

        const { data: acRows } = await supabase
          .from("appointment_aftercare")
          .select("id, send_at, sent_at, body_html, appointment_id")
          .in("appointment_id", apptIds)
          .order("send_at", { ascending: false });
        setAftercare((acRows ?? []) as any);
      } else {
        setConsents([]); setPayments([]); setAftercare([]);
      }

      // Shared notes (RLS only returns visible_to_patient = true)
      if (client?.id) {
        const { data: noteRows } = await supabase
          .from("client_notes")
          .select("id, body, created_at, shared_at, visible_to_patient")
          .eq("client_id", client.id)
          .eq("visible_to_patient", true)
          .order("created_at", { ascending: false });
        setNotes((noteRows ?? []) as any);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load your portal");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [slug]);

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const brand = profile?.brand_color || "#1f2937";
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = appts.filter((a) => a.scheduled_date >= today && a.status !== "cancelled");
  const past = appts
    .filter((a) => a.scheduled_date < today || a.status === "cancelled" || a.status === "completed")
    .sort((a, b) => (b.scheduled_date + b.start_time).localeCompare(a.scheduled_date + a.start_time));

  // Aftercare pruning: hide from top-level once (a) associated appointment is >7 days old,
  // or (b) a newer confirmed/completed appointment has taken place. These are shown inside the
  // relevant past appointment card instead.
  const now = Date.now();
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const activeAftercare: any[] = [];
  const aftercareByAppt = new Map<string, any[]>();
  for (const ac of aftercare) {
    const appt = appts.find((a) => a.id === ac.appointment_id);
    const apptDate = appt?.scheduled_date ? new Date(`${appt.scheduled_date}T${appt.start_time || "00:00"}`).getTime() : null;
    const olderThanWeek = apptDate != null && (now - apptDate) > WEEK_MS;
    const hasNewerAppt = appt
      ? appts.some((b) =>
          b.id !== appt.id &&
          b.status !== "cancelled" &&
          (b.scheduled_date + (b.start_time || "")) > (appt.scheduled_date + (appt.start_time || ""))
        )
      : false;
    if (olderThanWeek || hasNewerAppt) {
      if (ac.appointment_id) {
        const list = aftercareByAppt.get(ac.appointment_id) ?? [];
        list.push(ac);
        aftercareByAppt.set(ac.appointment_id, list);
      }
    } else {
      activeAftercare.push(ac);
    }
  }




  function openCancel(a: Appt) {
    setCancelAgreed(false);
    setCancelTarget(a);
  }

  async function performCancel(confirmLate: boolean) {
    if (!cancelTarget) return;
    setCancelling(true);
    const { error } = await supabase.rpc("patient_cancel_appointment", {
      p_appointment_id: cancelTarget.id,
      p_confirm_late: confirmLate,
    } as any);
    setCancelling(false);
    if (error) return toast.error(error.message);
    toast.success("Appointment cancelled");
    setCancelTarget(null);
    loadAll();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8" style={{ color: "#111" }}>
      <header className="mb-8 flex items-center gap-4">
        {profile?.avatar_url && <img src={profile.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover" />}
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{profile?.clinic_name}</div>
          <h1 className="truncate text-2xl font-bold tracking-tight" style={{ color: brand }}>
            Hi{patientName ? `, ${patientName.split(" ")[0]}` : ""}
          </h1>
          <p className="text-xs text-muted-foreground">Your portal with {profile?.full_name ?? profile?.clinic_name}</p>
        </div>
        <Link to="/m/$slug" params={{ slug }}>
          <Button size="sm" variant="outline">Back to clinic</Button>
        </Link>
      </header>

      {/* Missing bookings claim */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs">
        <span className="text-muted-foreground">Missing a booking? It may have been made with a different email.</span>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setClaimOpen(true)}>
          Claim a booking
        </Button>
      </div>

      <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim a booking</DialogTitle>
            <DialogDescription>
              Enter the email address you used when you booked. We'll link those bookings to your account.
            </DialogDescription>
          </DialogHeader>
          <input
            type="email"
            autoFocus
            placeholder="you@example.com"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={claimEmail}
            onChange={(e) => setClaimEmail(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClaimOpen(false)} disabled={claiming}>Cancel</Button>
            <Button onClick={claimBookings} disabled={claiming || !claimEmail.trim()}>
              {claiming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Link bookings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointments (tabs) */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold" style={{ color: brand }}>
          <CalendarIcon className="h-4 w-4" />Appointments
        </h2>
        <Tabs defaultValue="upcoming">
          <TabsList className="mb-3">
            <TabsTrigger value="upcoming">Upcoming {upcoming.length > 0 && `(${upcoming.length})`}</TabsTrigger>
            <TabsTrigger value="previous">Previous {past.length > 0 && `(${past.length})`}</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming">
            {upcoming.length === 0 ? (
              <Empty msg="No upcoming appointments." cta={<Link to="/m/$slug" params={{ slug }}><Button size="sm">Book a treatment</Button></Link>} />
            ) : (
              <div className="space-y-3">
                {upcoming.map((a) => (
                  <ApptCard
                    key={a.id} a={a} brand={brand}
                    allowCancel={!!profile?.allow_patient_cancel}
                    allowReschedule={!!profile?.allow_patient_reschedule}
                    cancelCutoffHours={profile?.patient_cancel_cutoff_hours ?? 0}
                    rescheduleCutoffHours={profile?.patient_reschedule_cutoff_hours ?? 0}
                    maxReschedules={profile?.patient_reschedule_max ?? 999}
                    slug={slug}
                    onCancel={() => openCancel(a)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="previous">
            {past.length === 0 ? (
              <Empty msg="No previous appointments yet." />
            ) : (
              <div className="space-y-3">
                {past.map((a) => (
                  <ApptCard
                    key={a.id} a={a} brand={brand} slug={slug}
                    aftercare={aftercareByAppt.get(a.id) ?? []}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      <CancelDialog
        open={!!cancelTarget}
        onOpenChange={(v) => { if (!v) setCancelTarget(null); }}
        appt={cancelTarget}
        profile={profile}
        agreed={cancelAgreed}
        setAgreed={setCancelAgreed}
        loading={cancelling}
        onConfirm={performCancel}
      />


      {/* Medical forms */}
      <Section title="Medical forms" icon={ClipboardCheck} brand={brand}>
        {forms.length === 0 ? <Empty msg="No medical forms sent yet." /> : (
          <div className="space-y-2">
            {forms.map((f) => (
              <RowItem
                key={f.id}
                title={f.medical_form_templates?.name ?? "Medical form"}
                meta={f.status === "submitted" ? `Completed ${new Date(f.submitted_at).toLocaleDateString()}` : "Awaiting your completion"}
                badge={f.status === "submitted" ? "Complete" : "Pending"}
                badgeOk={f.status === "submitted"}
                href={`/f/${f.token}?returnTo=${encodeURIComponent(`/m/${slug}/account`)}`}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Consent forms */}
      <Section title="Consent forms" icon={ShieldCheck} brand={brand}>
        {consents.length === 0 ? <Empty msg="No consent forms yet." /> : (
          <div className="space-y-2">
            {consents.map((c) => (
              <RowItem
                key={c.id}
                title={c.consent_templates?.name ?? "Consent form"}
                meta={c.status === "signed" ? `Signed ${new Date(c.signed_at).toLocaleDateString()}` : "Awaiting your signature"}
                badge={c.status === "signed" ? "Signed" : "Pending"}
                badgeOk={c.status === "signed"}
                href={`/c/${c.token}`}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Aftercare */}
      <Section title="Aftercare guidance" icon={HeartPulse} brand={brand}>
        {aftercare.length === 0 ? (
          <Empty msg="Your practitioner will share aftercare here after your appointment." />
        ) : (
          <div className="space-y-3">
            {aftercare.map((ac) => <AftercareCard key={ac.id} ac={ac} brand={brand} appts={appts} />)}
          </div>
        )}
      </Section>

      {/* Shared notes */}
      <Section title="Notes from your practitioner" icon={StickyNote} brand={brand}>
        {notes.length === 0 ? <Empty msg="No shared notes yet." /> : (
          <div className="space-y-3">
            {notes.map((n) => (
              <Card key={n.id} className="border-l-4" style={{ borderLeftColor: brand }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Sparkles className="h-3 w-3" />Shared note · {new Date(n.shared_at || n.created_at).toLocaleDateString()}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{n.body}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {/* Past appointments */}
      <Section title="Past appointments" icon={FileText} brand={brand}>
        {past.length === 0 ? <Empty msg="No past appointments yet." /> : (
          <div className="space-y-3">{past.map((a) => <ApptCard key={a.id} a={a} brand={brand} slug={slug} />)}</div>
        )}
      </Section>


      {/* Invoices */}
      <Section title="Invoices & payments" icon={Receipt} brand={brand}>
        {payments.length === 0 ? <Empty msg="No payments on file yet." /> : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <div className="font-medium">£{((p.amount ?? 0) / 100).toFixed(2)} {(p.currency || "GBP").toUpperCase()}</div>
                  <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</div>
                </div>
                <Badge variant={p.status === "succeeded" ? "default" : "secondary"}>{p.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="mt-10">
        <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/m/$slug", params: { slug } }); }}>
          Sign out
        </Button>
      </div>
    </main>
  );
}

function Section({ title, icon: Icon, brand, children }: { title: string; icon: any; brand: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold" style={{ color: brand }}>
        <Icon className="h-4 w-4" />{title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ msg, cta }: { msg: string; cta?: React.ReactNode }) {
  return <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">{msg}{cta && <div className="mt-2">{cta}</div>}</div>;
}

function RowItem({ title, meta, badge, badgeOk, href }: { title: string; meta: string; badge: string; badgeOk: boolean; href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-muted/30">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{meta}</div>
      </div>
      <Badge variant={badgeOk ? "default" : "secondary"}>{badge}</Badge>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
    </a>
  );
}

function ApptCard({
  a, brand, slug, allowCancel, allowReschedule,
  cancelCutoffHours = 0, rescheduleCutoffHours = 0, maxReschedules = 999,
  onCancel,
}: {
  a: Appt; brand: string; slug: string;
  allowCancel?: boolean; allowReschedule?: boolean;
  cancelCutoffHours?: number; rescheduleCutoffHours?: number; maxReschedules?: number;
  onCancel?: () => void;
}) {
  const remaining = Math.max(0, maxReschedules - (a.reschedule_count ?? 0));
  const treatmentName = a.treatments?.name ?? a.treatment_name_snapshot ?? "Treatment";
  const hoursUntil = hoursBetweenNowAnd(a.scheduled_date, a.start_time);
  const rescheduleTooLate = allowReschedule && hoursUntil < rescheduleCutoffHours;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span style={{ color: brand }}>{treatmentName}</span>
          <Badge variant={a.status === "confirmed" ? "default" : a.status === "cancelled" ? "destructive" : "secondary"}>{a.status ?? "pending"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" />{a.scheduled_date}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{a.start_time?.slice(0, 5)}–{a.end_time?.slice(0, 5)}</span>
          {a.locations?.name && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{a.locations.name}</span>}
        </div>
        {(allowCancel || allowReschedule) && a.status !== "cancelled" && a.status !== "completed" && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {allowReschedule && a.treatment_id && remaining > 0 && !rescheduleTooLate && (
              <Link to="/m/$slug/book/$treatmentId" params={{ slug, treatmentId: a.treatment_id }}>
                <Button size="sm" variant="outline">Reschedule ({remaining} left)</Button>
              </Link>
            )}
            {allowReschedule && rescheduleTooLate && (
              <span className="text-[11px] text-muted-foreground">Reschedule needs {rescheduleCutoffHours}h notice — please contact the clinic.</span>
            )}
            {allowReschedule && !rescheduleTooLate && remaining === 0 && (
              <span className="text-[11px] text-muted-foreground">Reschedule limit reached — please contact the clinic.</span>
            )}
            {allowCancel && onCancel && (
              <Button size="sm" variant="ghost" onClick={onCancel}>Cancel appointment</Button>
            )}
            {allowCancel && cancelCutoffHours > 0 && (
              <span className="text-[11px] text-muted-foreground">Free cancel up to {cancelCutoffHours}h before</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function hoursBetweenNowAnd(date?: string, time?: string): number {
  if (!date || !time) return Infinity;
  const dt = new Date(`${date}T${time}`);
  return (dt.getTime() - Date.now()) / 3_600_000;
}

function AftercareCard({ ac, brand, appts }: { ac: any; brand: string; appts: Appt[] }) {
  const [open, setOpen] = useState(false);
  const appt = appts.find((a) => a.id === ac.appointment_id);
  const title = appt ? (appt.treatments?.name ?? appt.treatment_name_snapshot ?? "Treatment") : "Aftercare";
  const when = ac.sent_at || ac.send_at;
  return (
    <Card className="border-l-4 overflow-hidden" style={{ borderLeftColor: brand }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/30"
      >
        <div className="grid h-9 w-9 flex-none place-items-center rounded-full" style={{ background: `${brand}18`, color: brand }}>
          <HeartPulse className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{title} · Aftercare</div>
          <div className="text-[11px] text-muted-foreground">
            {when ? new Date(when).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : ""}
            {appt?.scheduled_date && ` · for appt ${appt.scheduled_date}`}
          </div>
        </div>
        <Badge variant={ac.sent_at ? "default" : "secondary"} className="hidden sm:inline-flex">
          {ac.sent_at ? "Delivered" : "Scheduled"}
        </Badge>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t bg-muted/20 px-4 py-3">
          <div
            className="prose prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5"
            dangerouslySetInnerHTML={{ __html: ac.body_html ?? "<em>No content</em>" }}
          />
        </div>
      )}
    </Card>
  );
}

function CancelDialog({
  open, onOpenChange, appt, profile, agreed, setAgreed, loading, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appt: Appt | null;
  profile: Profile | null;
  agreed: boolean;
  setAgreed: (v: boolean) => void;
  loading: boolean;
  onConfirm: (confirmLate: boolean) => void;
}) {
  if (!appt || !profile) return null;
  const cutoff = profile.patient_cancel_cutoff_hours ?? 0;
  const mode = profile.late_cancel_mode ?? "block";
  const hoursUntil = hoursBetweenNowAnd(appt.scheduled_date, appt.start_time);
  const isLate = hoursUntil < cutoff;
  const rules: CancellationRule[] = Array.isArray(profile.cancellation_rules) ? profile.cancellation_rules : [];
  const applicable = rules
    .slice()
    .sort((a, b) => a.hours_before - b.hours_before)
    .find((r) => hoursUntil < r.hours_before);
  const ruleLines = describeCancellationRules(rules);
  const contactEmail = profile.email;
  const contactPhone = profile.phone || profile.contact_sms_number || profile.contact_whatsapp_number;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isLate ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : null}
            Cancel appointment
          </DialogTitle>
          <DialogDescription>
            {appt.treatments?.name ?? appt.treatment_name_snapshot ?? "Treatment"} · {appt.scheduled_date} at {appt.start_time?.slice(0, 5)}
          </DialogDescription>
        </DialogHeader>

        {!isLate && (
          <p className="text-sm text-muted-foreground">
            You're outside the {cutoff}h cancellation window. This won't incur any charge.
          </p>
        )}

        {isLate && mode === "block" && (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Cancellations inside {cutoff}h of your appointment must be arranged directly with the clinic. Please get in touch below.
            </div>
            <div className="space-y-1 text-sm">
              {contactEmail && (
                <a href={`mailto:${contactEmail}?subject=${encodeURIComponent("Cancel appointment on " + appt.scheduled_date)}`} className="inline-flex items-center gap-2 underline">
                  <Mail className="h-4 w-4" /> {contactEmail}
                </a>
              )}
              {contactPhone && (
                <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> <a href={`tel:${contactPhone}`} className="underline">{contactPhone}</a></div>
              )}
              {!contactEmail && !contactPhone && (
                <div className="text-muted-foreground">Please contact your practitioner directly.</div>
              )}
            </div>
          </div>
        )}

        {isLate && mode === "warn_agree" && (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-medium">Late cancellation ({cutoff}h notice)</div>
              {applicable ? (
                <div className="mt-1">A <strong>{applicable.fee_percent}%</strong> cancellation fee applies to this booking.</div>
              ) : (
                <div className="mt-1">A cancellation fee may apply as per the clinic's policy.</div>
              )}
            </div>
            {ruleLines.length > 0 && (
              <div className="rounded-md border p-3 text-xs text-muted-foreground">
                <div className="mb-1 font-medium text-foreground">Clinic policy</div>
                <ul className="list-disc space-y-0.5 pl-4">
                  {ruleLines.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              </div>
            )}
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
              <span>I understand and agree to be charged as per the clinic's cancellation policy.</span>
            </label>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Keep appointment</Button>
          {!isLate && (
            <Button variant="destructive" onClick={() => onConfirm(false)} disabled={loading}>
              {loading ? "Cancelling…" : "Cancel appointment"}
            </Button>
          )}
          {isLate && mode === "warn_agree" && (
            <Button variant="destructive" disabled={!agreed || loading} onClick={() => onConfirm(true)}>
              {loading ? "Cancelling…" : "Confirm cancellation"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

