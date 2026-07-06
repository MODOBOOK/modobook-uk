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
import { SafeHtml } from "@/components/SafeHtml";


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
  const [myClient, setMyClient] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);

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

      // Linked clinic_client (RLS-scoped to me). Read via the security-definer
      // RPC to bypass any RLS/timing race right after link_patient_account.
      const { data: linkedId } = await supabase.rpc("current_patient_client_id", { _profile_id: prof.id });
      let client: any = null;
      if (linkedId) {
        const { data: c } = await supabase
          .from("clinic_clients")
          .select("id, full_name, email, phone, dob, gender, address_line1, address_line2, county, postcode, preferred_contact, emergency_contact_name, emergency_contact_phone, gp_name, gp_address")
          .eq("id", linkedId as string)
          .maybeSingle();
        client = c ?? null;
      }
      const metaName = (sess.session.user.user_metadata as { full_name?: string } | null)?.full_name?.trim();
      const emailPrefix = sess.session.user.email?.split("@")[0] ?? "";
      const display = (client?.full_name && client.full_name.trim()) || metaName || emailPrefix;
      setPatientName(display);
      setMyClient(client);


      // Appointments — exclude "pending" placeholders that haven't been paid yet.
      // These are Stripe checkout holds; until Stripe confirms payment the
      // appointment shouldn't appear on the patient's account.
      
      const myEmail = (sess.session.user.email ?? "").toLowerCase();
      const { data: apptRows } = await supabase
        .from("appointments")
        .select("id, scheduled_date, start_time, end_time, status, payment_status, amount_paid_cents, payment_hold_expires_at, total_amount, treatment_id, reschedule_count, treatment_name_snapshot, patient_user_id, patient_email, treatments(name), locations(name)")
        .eq("profile_id", prof.id)
        .or(`patient_user_id.eq.${sess.session.user.id}${myEmail ? `,patient_email.ilike.${myEmail}` : ""}`)
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

  // Refresh my details in real time when the practitioner (or another tab)
  // updates my clinic record — greeting/name/contact reflect immediately.
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`clinic_clients-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clinic_clients", filter: `profile_id=eq.${profile.id}` },
        async () => {
          const { data: linkedId } = await supabase.rpc("current_patient_client_id", { _profile_id: profile.id });
          if (!linkedId) return;
          const { data: client } = await supabase
            .from("clinic_clients")
            .select("id, full_name, email, phone, dob, gender, address_line1, address_line2, county, postcode, preferred_contact, emergency_contact_name, emergency_contact_phone, gp_name, gp_address")
            .eq("id", linkedId as string)
            .maybeSingle();
          if (client) {
            setMyClient(client);
            if (client.full_name && client.full_name.trim()) setPatientName(client.full_name);
          }
        },
      )
      .subscribe();
    // Also refresh on tab focus in case realtime missed an event.
    const onFocus = () => { loadAll(); };
    window.addEventListener("focus", onFocus);
    return () => { supabase.removeChannel(channel); window.removeEventListener("focus", onFocus); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // If we've just returned from Stripe Checkout, reconcile the session so the
  // appointment flips to "paid" even when the connected-account webhook isn't
  // wired. This is idempotent — the webhook still runs the same update.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get("session_id");
    const paid = url.searchParams.get("paid");
    if (!sessionId || paid !== "1") return;
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("@/lib/stripe-confirm.functions");
        const res = await mod.confirmCheckoutSession({ data: { sessionId, slug } });
        if (cancelled) return;
        if ((res as { ok?: boolean }).ok) {
          toast.success("Payment confirmed");
          loadAll();
          url.searchParams.delete("session_id");
          url.searchParams.delete("paid");
          window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
        }
      } catch (e) {
        console.error("[confirmCheckoutSession] failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

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
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>Edit my details</Button>
          <Link to="/m/$slug" params={{ slug }}>
            <Button size="sm" variant="outline">Back to clinic</Button>
          </Link>
        </div>
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

      <EditMyDetailsDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        slug={slug}
        initial={myClient}
        onSaved={() => { setEditOpen(false); loadAll(); }}
      />

      {/* Treatment plans */}
      <PatientTreatmentPlans slug={slug} brand={brand} />

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


      {/* Medical forms — only those still needing completion. Every new
          appointment triggers a fresh row, so a prior submission for another
          appointment should not be shown here as "Complete" (that only makes
          patients think the current appointment's form is already done). */}
      <Section title="Medical forms" icon={ClipboardCheck} brand={brand}>
        {(() => {
          const pending = forms.filter((f) => f.status !== "submitted");
          if (pending.length === 0) {
            return <Empty msg="No medical forms need your attention right now." />;
          }
          return (
            <div className="space-y-2">
              {pending.map((f) => (
                <RowItem
                  key={f.id}
                  title={f.medical_form_templates?.name ?? "Medical form"}
                  meta="Awaiting your completion"
                  badge="Pending"
                  badgeOk={false}
                  href={`/f/${f.token}?returnTo=${encodeURIComponent(`/m/${slug}/account`)}`}
                />
              ))}
            </div>
          );
        })()}
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

      {/* Aftercare (active only — older or superseded aftercare is tucked into Previous appointments) */}
      <Section title="Aftercare guidance" icon={HeartPulse} brand={brand}>
        {activeAftercare.length === 0 ? (
          <Empty msg="Your practitioner will share aftercare here after your appointment. Older aftercare is filed under Previous appointments." />
        ) : (
          <div className="space-y-3">
            {activeAftercare.map((ac) => <AftercareCard key={ac.id} ac={ac} brand={brand} appts={appts} />)}
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

      <DataPrivacySection
        slug={slug}
        profileId={profile!.id}
        brand={brand}
        onErased={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/m/$slug", params: { slug } });
        }}
      />

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
  onCancel, aftercare = [],
}: {
  a: Appt; brand: string; slug: string;
  allowCancel?: boolean; allowReschedule?: boolean;
  cancelCutoffHours?: number; rescheduleCutoffHours?: number; maxReschedules?: number;
  onCancel?: () => void;
  aftercare?: any[];
}) {
  const remaining = Math.max(0, maxReschedules - (a.reschedule_count ?? 0));
  const treatmentName = a.treatments?.name ?? a.treatment_name_snapshot ?? "Treatment";
  const hoursUntil = hoursBetweenNowAnd(a.scheduled_date, a.start_time);
  const rescheduleTooLate = allowReschedule && hoursUntil < rescheduleCutoffHours;
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-6 py-4 text-left hover:bg-muted/30 rounded-t-lg"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-base font-semibold" style={{ color: brand }}>
            <span className="truncate">{treatmentName}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" />{a.scheduled_date}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{a.start_time?.slice(0, 5)}–{a.end_time?.slice(0, 5)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={a.status === "confirmed" ? "default" : a.status === "cancelled" ? "destructive" : "secondary"}>{a.status ?? "pending"}</Badge>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <CardContent className="space-y-3 border-t pt-4 text-sm">
          {a.locations?.name && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{a.locations.name}</span>
            </div>
          )}
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
          {aftercare.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Aftercare</div>
              {aftercare.map((ac) => <InlineAftercare key={ac.id} ac={ac} brand={brand} />)}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function InlineAftercare({ ac, brand }: { ac: any; brand: string }) {
  const [open, setOpen] = useState(false);
  const when = ac.sent_at || ac.send_at;
  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/30"
      >
        <HeartPulse className="h-3.5 w-3.5" style={{ color: brand }} />
        <span className="flex-1 truncate">Aftercare · {when ? new Date(when).toLocaleDateString() : ""}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t bg-muted/20 px-3 py-2">
          <SafeHtml
            html={ac.body_html ?? "<em>No content</em>"}
            className="prose prose-sm max-w-none prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5"
          />
        </div>

      )}
    </div>
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
          <SafeHtml
            html={ac.body_html ?? "<em>No content</em>"}
            className="prose prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5"
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

function EditMyDetailsDialog({
  open, onOpenChange, slug, initial, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slug: string;
  initial: any;
  onSaved: () => void;
}) {
  const [f, setF] = useState<any>(initial ?? {});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setF(initial ?? {}); }, [initial, open]);

  async function save() {
    setSaving(true);
    const { error } = await supabase.rpc("patient_update_own_client", {
      p_slug: slug,
      p_full_name: f.full_name ?? null,
      p_email: f.email ?? null,
      p_phone: f.phone ?? null,
      p_dob: f.dob || null,
      p_gender: f.gender ?? null,
      p_address_line1: f.address_line1 ?? null,
      p_address_line2: f.address_line2 ?? null,
      p_county: f.county ?? null,
      p_postcode: f.postcode ?? null,
      p_preferred_contact: f.preferred_contact ?? null,
      p_emergency_contact_name: f.emergency_contact_name ?? null,
      p_emergency_contact_phone: f.emergency_contact_phone ?? null,
      p_gp_name: f.gp_name ?? null,
      p_gp_address: f.gp_address ?? null,
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Details updated");
    onSaved();
  }

  const field = (label: string, key: string, type: string = "text") => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        className="w-full rounded-md border px-3 py-2 text-sm"
        value={f?.[key] ?? ""}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit my details</DialogTitle>
          <DialogDescription>Update your personal, contact, and emergency information.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {field("Full name", "full_name")}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("Email", "email", "email")}
            {field("Phone", "phone", "tel")}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("Date of birth", "dob", "date")}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Gender</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={f?.gender ?? ""}
                onChange={(e) => setF({ ...f, gender: e.target.value })}
              >
                <option value="">Select…</option>
                {["Female","Male","Non-binary","Other","Prefer not to say"].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</div>
          {field("Address line 1", "address_line1")}
          {field("Address line 2", "address_line2")}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("County", "county")}
            {field("Postcode", "postcode")}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Preferred contact</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={f?.preferred_contact ?? ""}
              onChange={(e) => setF({ ...f, preferred_contact: e.target.value })}
            >
              <option value="">Any</option>
              {["Email","Phone","SMS"].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Emergency contact</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("Contact name", "emergency_contact_name")}
            {field("Contact phone", "emergency_contact_phone", "tel")}
          </div>
          <div className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">GP</div>
          {field("GP name", "gp_name")}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">GP address</label>
            <textarea
              rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={f?.gp_address ?? ""}
              onChange={(e) => setF({ ...f, gp_address: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DataPrivacySection({
  slug, profileId, brand, onErased,
}: { slug: string; profileId: string; brand: string; onErased: () => void | Promise<void> }) {
  const [exporting, setExporting] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function exportData() {
    setExporting(true);
    try {
      const [
        { data: { user } },
        clientRes, apptsRes, formsRes, consentsRes, notesRes,
        aftercareRes, paymentsRes, prescriptionsRes,
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("clinic_clients").select("*").eq("profile_id", profileId),
        supabase.from("appointments").select("*").eq("profile_id", profileId),
        supabase.from("appointment_medical_forms").select("*").eq("profile_id", profileId),
        supabase.from("appointment_consents").select("*").eq("profile_id", profileId),
        supabase.from("client_notes").select("*").eq("profile_id", profileId).eq("visible_to_patient", true),
        supabase.from("appointment_aftercare").select("*").eq("profile_id", profileId),
        supabase.from("payments").select("*").eq("profile_id", profileId),
        supabase.from("client_prescriptions").select("*").eq("profile_id", profileId),
      ]);
      const bundle = {
        exported_at: new Date().toISOString(),
        clinic_slug: slug,
        user: { id: user?.id, email: user?.email },
        client_record: clientRes.data ?? [],
        appointments: apptsRes.data ?? [],
        medical_forms: formsRes.data ?? [],
        consents: consentsRes.data ?? [],
        notes_shared_with_you: notesRes.data ?? [],
        aftercare: aftercareRes.data ?? [],
        payments: paymentsRes.data ?? [],
        prescriptions: prescriptionsRes.data ?? [],
      };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `modo-${slug}-my-data-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data has been downloaded.");
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function requestErasure() {
    setErasing(true);
    const { error } = await supabase.rpc("patient_request_erasure", { p_slug: slug } as any);
    setErasing(false);
    if (error) return toast.error(error.message);
    toast.success("Your personal details have been erased.");
    setConfirmOpen(false);
    await onErased();
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold" style={{ color: brand }}>
        <ShieldCheck className="h-4 w-4" />Data & privacy
      </h2>
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">Download my data</div>
            <p className="text-xs text-muted-foreground">
              Get a copy of everything this clinic holds about you — profile, bookings, forms, consents, prescriptions and payments — as a JSON file.
            </p>
            <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
              {exporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Download JSON
            </Button>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Erase my personal details</div>
            <p className="text-xs text-muted-foreground">
              Removes your name, contact, address, GP and emergency-contact details from this clinic.
              Clinical records (medical forms, consents, prescriptions and bookings) are anonymised and
              retained for UK statutory periods (8 years clinical, 10 years prescriptions, 7 years financial).
              Your patient login for this clinic will be removed.
            </p>
            <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
              Request erasure
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) setConfirmText(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm erasure</DialogTitle>
            <DialogDescription>
              This cannot be undone. Your personal details will be erased at this clinic immediately and you will be signed out.
              Clinical records are retained (anonymised) to meet UK regulatory retention rules.
              Type <strong>ERASE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="ERASE"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={erasing}>Cancel</Button>
            <Button variant="destructive" onClick={requestErasure} disabled={erasing || confirmText !== "ERASE"}>
              {erasing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Erase my details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PatientTreatmentPlans({ slug, brand }: { slug: string; brand: string }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const mod = await import("@/lib/treatment-plans.functions");
      const rows = await mod.listMyPlansForPractitioner({ data: { slug } });
      setPlans(rows);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [slug]);

  const respond = async (id: string, accept: boolean) => {
    try {
      const mod = await import("@/lib/treatment-plans.functions");
      if (accept) await mod.acceptPlan({ data: { id } });
      else await mod.declinePlan({ data: { id } });
      toast.success(accept ? "Plan accepted" : "Plan declined");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) return null;
  if (plans.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold" style={{ color: brand }}>
        <ClipboardCheck className="h-4 w-4" />Treatment plans
      </h2>
      <div className="space-y-3">
        {plans.map((p: any) => {
          const total = (p.sessions || []).length;
          const done = (p.sessions || []).filter((s: any) => s.status === "completed").length;
          const pct = total ? (done / total) * 100 : 0;
          return (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                  </div>
                  <Badge>{p.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: brand }} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{done} of {total} sessions complete</div>
                </div>
                <div className="space-y-1">
                  {(p.sessions || [])
                    .slice()
                    .sort((a: any, b: any) => a.session_number - b.session_number)
                    .map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between text-sm border-b py-1 last:border-0">
                        <span>
                          <span className="font-medium">{s.session_number}.</span>{" "}
                          {s.treatment?.name ?? "Session"}
                          {s.interval_weeks_from_previous && s.session_number > 1 && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              (+{s.interval_weeks_from_previous} wks)
                            </span>
                          )}
                        </span>
                        <Badge variant="outline" className="text-xs">{s.status}</Badge>
                      </div>
                    ))}
                </div>
                {p.status === "sent" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => respond(p.id, true)} style={{ backgroundColor: brand }}>
                      Accept plan
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => respond(p.id, false)}>
                      Decline
                    </Button>
                  </div>
                )}
                {(p.status === "accepted" || p.status === "in_progress") && (
                  <Link to="/m/$slug" params={{ slug }}>
                    <Button size="sm" style={{ backgroundColor: brand }}>Book next session</Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}




