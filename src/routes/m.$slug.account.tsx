import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2, Calendar as CalendarIcon, Clock, MapPin, FileText, StickyNote,
  ClipboardCheck, Receipt, ShieldCheck, ExternalLink, Sparkles, HeartPulse,
  Mail, Phone, AlertTriangle, ChevronDown, Gift, Copy, Share2, Coins, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { describeCancellationRules, type CancellationRule } from "@/lib/policy";
import { SafeHtml } from "@/components/SafeHtml";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRewardsForClinic } from "@/lib/rewards.functions";
import { autoRefundCancelledAppointment } from "@/lib/refunds.functions";


export const Route = createFileRoute("/m/$slug/account")({
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
  const autoRefund = useServerFn(autoRefundCancelledAppointment);

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
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [registering, setRegistering] = useState(false);
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

  async function registerWithClinic() {
    setRegistering(true);
    try {
      const { error } = await supabase.rpc("link_patient_account", { p_slug: slug });
      if (error) throw error;
      setNeedsRegistration(false);
      await loadAll();
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't create your account with this clinic");
    } finally {
      setRegistering(false);
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

      const signedInEmail = (sess.session.user.email ?? "").trim().toLowerCase();
      if (signedInEmail.endsWith("@modo.demo") && slug !== "demo-clinic") {
        await supabase.auth.signOut({ scope: "local" });
        navigate({ to: "/m/$slug/auth", params: { slug }, search: { redirect: `/m/${slug}/account` }, replace: true });
        return;
      }

      // Public profile + rules (via security-definer RPC — profiles has no
      // anon/authenticated SELECT policy, so a direct select would return null).
      const { data: profRows } = await supabase.rpc(
        "get_patient_account_profile_by_slug",
        { p_slug: slug } as never,
      );
      const prof = Array.isArray(profRows) ? profRows[0] : profRows;
      if (!prof) throw new Error("Practitioner not found");
      setProfile(prof as Profile);

      // Each clinic is a separate patient record. Never auto-create one just
      // because the visitor happens to be signed in from another clinic's
      // portal — only link when they already have history here, otherwise ask
      // them to explicitly register with THIS clinic.
      const { data: existingLink } = await supabase.rpc("current_patient_client_id", { _profile_id: prof.id });
      if (!existingLink) {
        const sessionEmail = signedInEmail;
        const { data: priorAppts } = await supabase
          .from("appointments")
          .select("id")
          .eq("profile_id", prof.id)
          .or(`patient_user_id.eq.${sess.session.user.id}${sessionEmail ? `,patient_email.ilike.${sessionEmail}` : ""}`)
          .limit(1);
        if (priorAppts && priorAppts.length > 0) {
          const { error: linkErr } = await supabase.rpc("link_patient_account", { p_slug: slug });
          if (linkErr) throw linkErr;
        } else {
          setNeedsRegistration(true);
          setLoading(false);
          return;
        }
      }
      setNeedsRegistration(false);


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
      
      const myEmail = signedInEmail;
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
          .select("id, amount, status, created_at, appointment_id")
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
    const piId = url.searchParams.get("pi");
    const paid = url.searchParams.get("paid");
    if ((!sessionId && !piId) || paid !== "1") return;
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("@/lib/stripe-confirm.functions");
        const res = sessionId
          ? await mod.confirmCheckoutSession({ data: { sessionId, slug } })
          : await mod.confirmBookingPaymentIntent({ data: { paymentIntentId: piId!, slug } });
        if (cancelled) return;
        if ((res as { ok?: boolean }).ok) {
          toast.success("Payment confirmed");
          loadAll();
          url.searchParams.delete("session_id");
          url.searchParams.delete("pi");
          url.searchParams.delete("paid");
          window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
        }
      } catch (e) {
        console.error("[confirm payment] failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);


  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (needsRegistration) {
    const clinicLabel = profile?.clinic_name || profile?.full_name || "this clinic";
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Register with {clinicLabel}</CardTitle>
            <CardDescription>
              Your records are held separately by each clinic. You don't have an account
              with {clinicLabel} yet — nothing from your other clinics is shared here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={registerWithClinic} disabled={registering}>
              {registering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create my account with {clinicLabel}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/m/$slug/auth", params: { slug }, search: { tab: "signup" } });
              }}
            >
              Use a different email
            </Button>
          </CardContent>
        </Card>
      </main>
    );
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
    try {
      const r = await autoRefund({ data: { appointmentId: cancelTarget.id } });
      if (r.refunded) {
        toast.success(`Appointment cancelled — £${(r.refundedCents / 100).toFixed(2)} refunded`);
      } else {
        toast.success("Appointment cancelled");
      }
    } catch {
      toast.success("Appointment cancelled");
    }
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
          <Link to="/m/$slug/rewards" params={{ slug }}>
            <Button size="sm" variant="outline">Refer & earn</Button>
          </Link>
          <Link to="/m/$slug" params={{ slug }}>
            <Button size="sm" variant="outline">Back to clinic</Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Signed out");
              navigate({ to: "/m/$slug/auth", params: { slug }, replace: true });
            }}
          >
            Sign out
          </Button>
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

      {/* Rewards hero — always at the top so it's forefront */}
      <RewardsHero slug={slug} brand={brand} />

      {/* Treatment plans */}
      <PatientTreatmentPlans slug={slug} brand={brand} />

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

      {(() => {
        const pendingForms = forms.filter((f) => f.status !== "submitted");
        const pendingConsents = consents.filter((c) => c.status !== "signed");
        const paperworkCount = pendingForms.length + pendingConsents.length;
        const careCount = activeAftercare.length + notes.length;
        return (
          <Tabs defaultValue="appointments" className="mt-8">
            <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsList className="inline-flex w-max min-w-full gap-1 px-1">
                <TabsTrigger value="appointments" className="whitespace-nowrap">
                  Visits{upcoming.length > 0 && <span className="ml-1 text-xs opacity-70">({upcoming.length})</span>}
                </TabsTrigger>
                <TabsTrigger value="paperwork" className="whitespace-nowrap">
                  Paperwork{paperworkCount > 0 && <span className="ml-1 text-xs opacity-70">({paperworkCount})</span>}
                </TabsTrigger>
                <TabsTrigger value="care" className="whitespace-nowrap">
                  Care{careCount > 0 && <span className="ml-1 text-xs opacity-70">({careCount})</span>}
                </TabsTrigger>
                <TabsTrigger value="rewards" id="tab-rewards" className="whitespace-nowrap">Rewards</TabsTrigger>
                <TabsTrigger value="account" className="whitespace-nowrap">Account</TabsTrigger>
              </TabsList>
            </div>


            {/* VISITS */}
            <TabsContent value="appointments" className="mt-4">
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
            </TabsContent>

            {/* PAPERWORK */}
            <TabsContent value="paperwork" className="mt-4 space-y-6">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: brand }}>
                  <ClipboardCheck className="h-4 w-4" />Medical forms
                </div>
                {pendingForms.length === 0 ? (
                  <Empty msg="No medical forms need your attention right now." />
                ) : (
                  <div className="space-y-2">
                    {pendingForms.map((f) => (
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
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: brand }}>
                  <ShieldCheck className="h-4 w-4" />Consent forms
                </div>
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
              </div>
            </TabsContent>

            {/* CARE */}
            <TabsContent value="care" className="mt-4 space-y-6">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: brand }}>
                  <HeartPulse className="h-4 w-4" />Aftercare
                </div>
                {activeAftercare.length === 0 ? (
                  <Empty msg="Your practitioner will share aftercare here after your appointment. Older guidance is filed under Previous visits." />
                ) : (
                  <div className="space-y-3">
                    {activeAftercare.map((ac) => <AftercareCard key={ac.id} ac={ac} brand={brand} appts={appts} />)}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: brand }}>
                  <StickyNote className="h-4 w-4" />Notes from your practitioner
                </div>
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
              </div>
            </TabsContent>

            {/* ACCOUNT */}
            {/* REWARDS */}
            <TabsContent value="rewards" className="mt-4">
              <RewardsTabContent slug={slug} brand={brand} />
            </TabsContent>

            <TabsContent value="account" className="mt-4 space-y-6">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: brand }}>
                  <Receipt className="h-4 w-4" />Invoices & payments
                </div>
                {payments.length === 0 ? <Empty msg="No payments on file yet." /> : (
                  <div className="space-y-2">
                    {payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                        <div>
                          <div className="font-medium">£{((p.amount ?? 0) / 100).toFixed(2)} GBP</div>
                          <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</div>
                        </div>
                        <Badge variant={p.status === "succeeded" ? "default" : "secondary"}>{p.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <PrivacyContactSection
                slug={slug}
                profile={profile!}
                brand={brand}
                onErased={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/m/$slug/auth", params: { slug }, replace: true });
                }}
              />

              <div className="pt-2">
                <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/m/$slug/auth", params: { slug }, replace: true }); }}>
                  Sign out
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        );
      })()}

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

  const [showMore, setShowMore] = useState(false);

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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>My details</DialogTitle>
          <DialogDescription>Keep your basics up to date.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {field("Full name", "full_name")}
          {field("Email", "email", "email")}
          {field("Phone", "phone", "tel")}
          {field("Date of birth", "dob", "date")}

          <button
            type="button"
            className="mt-1 text-left text-xs font-medium text-muted-foreground underline underline-offset-2"
            onClick={() => setShowMore((s) => !s)}
          >
            {showMore ? "Hide additional details" : "Add address, emergency contact & GP"}
          </button>

          {showMore && (
            <div className="grid gap-3 rounded-md border bg-muted/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</div>
              {field("Address line 1", "address_line1")}
              <div className="grid grid-cols-2 gap-3">
                {field("County", "county")}
                {field("Postcode", "postcode")}
              </div>

              <div className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Emergency contact</div>
              <div className="grid grid-cols-2 gap-3">
                {field("Name", "emergency_contact_name")}
                {field("Phone", "emergency_contact_phone", "tel")}
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
          )}
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


function PrivacyContactSection({
  slug, profile, brand, onErased,
}: { slug: string; profile: Profile; brand: string; onErased: () => void | Promise<void> }) {
  const [erasing, setErasing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function requestErasure() {
    setErasing(true);
    const { error } = await supabase.rpc("patient_request_erasure", { p_slug: slug } as any);
    setErasing(false);
    if (error) return toast.error(error.message);
    toast.success("Your personal details have been erased.");
    setConfirmOpen(false);
    await onErased();
  }

  const email = profile.email;
  const phone = profile.phone;
  const sms = profile.contact_sms_number;
  const wa = profile.contact_whatsapp_number;
  const hasAnyContact = !!(email || phone || sms || wa);

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold" style={{ color: brand }}>
        <ShieldCheck className="h-4 w-4" />Contact & privacy
      </h2>
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">Contact your practitioner</div>
            <p className="text-xs text-muted-foreground">
              Need to reach {profile.full_name ?? profile.clinic_name ?? "your practitioner"} directly? Use the details below.
            </p>
            {hasAnyContact ? (
              <div className="space-y-1 text-sm">
                {email && (
                  <a href={`mailto:${email}`} className="flex items-center gap-2 underline">
                    <Mail className="h-4 w-4" /> {email}
                  </a>
                )}
                {phone && (
                  <a href={`tel:${phone}`} className="flex items-center gap-2 underline">
                    <Phone className="h-4 w-4" /> {phone}
                  </a>
                )}
                {sms && sms !== phone && (
                  <a href={`sms:${sms}`} className="flex items-center gap-2 underline">
                    <Phone className="h-4 w-4" /> {sms} (SMS)
                  </a>
                )}
                {wa && (
                  <a href={`https://wa.me/${wa.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline">
                    <Phone className="h-4 w-4" /> {wa} (WhatsApp)
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No contact details published yet.</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Erase my personal details</div>
            <p className="text-xs text-muted-foreground">
              Removes your name, contact, address, GP and emergency-contact details from this clinic.
              Clinical records (medical forms, consents, prescriptions and bookings) are anonymised and
              retained for UK statutory periods. Your patient login for this clinic will be removed.
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
                {total > 0 && (
                  <div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: brand }} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{done} of {total} sessions complete</div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {p.patient_token && (
                    <a href={`/plan/${p.patient_token}`} target="_blank" rel="noreferrer">
                      <Button size="sm" style={{ backgroundColor: brand }}>
                        {p.status === "sent" ? "Review & respond" : "View full plan"}
                      </Button>
                    </a>
                  )}
                  {(p.status === "accepted" || p.status === "in_progress") && (
                    <Link to="/m/$slug" params={{ slug }}>
                      <Button size="sm" variant="outline">Book next session</Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function fmtRewardsGBP(pennies: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: pennies % 100 === 0 ? 0 : 2,
  }).format(pennies / 100);
}

function useMyRewards(slug: string) {
  const fetchRewards = useServerFn(getMyRewardsForClinic);
  return useQuery({
    queryKey: ["portal-rewards", slug],
    queryFn: () => fetchRewards({ data: { slug } }),
    staleTime: 30_000,
  });
}

function RewardsHero({ slug, brand }: { slug: string; brand: string }) {
  const q = useMyRewards(slug);
  const d = q.data;
  const s: any = d?.settings;
  if (!d || !s?.enabled) return null;

  const you: string[] = [];
  if (s.referrer_credit_kind === "percent" && s.referrer_credit_percent > 0)
    you.push(`${s.referrer_credit_percent}% off`);
  else if (s.referrer_credit_pennies > 0)
    you.push(`${fmtRewardsGBP(s.referrer_credit_pennies)} credit`);
  if (s.referrer_points > 0) you.push(`${s.referrer_points} pts`);
  const friend: string[] = [];
  if (s.friend_credit_kind === "percent" && s.friend_credit_percent > 0)
    friend.push(`${s.friend_credit_percent}% off first booking`);
  else if (s.friend_credit_pennies > 0)
    friend.push(`${fmtRewardsGBP(s.friend_credit_pennies)} off first booking`);

  return (
    <section className="mt-4">
      <div
        className="overflow-hidden rounded-2xl border shadow-sm"
        style={{ background: `linear-gradient(135deg, ${brand}18, ${brand}05)`, borderColor: `${brand}30` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${brand}20`, color: brand }}>
              <Gift className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: brand }}>Refer & earn</div>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="text-sm">
                  <span className="font-semibold">{fmtRewardsGBP(d.creditPennies)}</span> credit
                </span>
                <span className="text-sm">
                  <span className="font-semibold">{d.points}</span> pts
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {friend.length > 0 && <>Friend gets {friend.join(" · ")}. </>}
                {you.length > 0 && <>You get {you.join(" + ")}.</>}
              </div>
            </div>
          </div>
          <Button size="sm" onClick={() => {
            const el = document.getElementById("tab-rewards");
            el?.click();
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }} style={{ background: brand, color: "white" }}>
            View rewards <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function RewardsTabContent({ slug, brand }: { slug: string; brand: string }) {
  const q = useMyRewards(slug);
  if (q.isLoading) return <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>;
  if (q.error) return <div className="p-6 text-center text-sm text-destructive">{(q.error as Error).message}</div>;
  const d = q.data!;
  const s: any = d.settings;
  const enabled = !!s?.enabled;

  if (!enabled) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {d.clinic.name} hasn't turned on rewards yet — check back soon.
        </CardContent>
      </Card>
    );
  }

  const shareText = d.code
    ? `Book with ${d.clinic.name} and use my referral code ${d.code} at checkout.`
    : "";
  const copy = async () => {
    if (!d.code) return;
    try { await navigator.clipboard.writeText(d.code); toast.success("Code copied"); }
    catch { toast.error("Couldn't copy"); }
  };
  const share = async () => {
    if (!d.code) return;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try { await (navigator as any).share({ title: "Referral code", text: shareText }); return; } catch { /* fall through */ }
    }
    try { await navigator.clipboard.writeText(shareText); toast.success("Message copied — paste it to your friend"); }
    catch { toast.error("Couldn't copy"); }
  };

  const you: string[] = [];
  if (s.referrer_credit_kind === "percent" && s.referrer_credit_percent > 0)
    you.push(`${s.referrer_credit_percent}% off next booking`);
  else if (s.referrer_credit_pennies > 0)
    you.push(`${fmtRewardsGBP(s.referrer_credit_pennies)} credit`);
  if (s.referrer_points > 0) you.push(`${s.referrer_points} loyalty points`);
  const friend: string[] = [];
  if (s.friend_credit_kind === "percent" && s.friend_credit_percent > 0)
    friend.push(`${s.friend_credit_percent}% off first booking`);
  else if (s.friend_credit_pennies > 0)
    friend.push(`${fmtRewardsGBP(s.friend_credit_pennies)} off first booking`);

  return (
    <div className="space-y-5">
      <Card className="border-l-4" style={{ borderLeftColor: brand }}>
        <CardContent className="space-y-4 p-5 text-center">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Your referral code</div>
          <div className="font-serif text-4xl tracking-widest" style={{ color: brand }}>
            {d.code ?? <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
          </div>
          <p className="text-xs text-muted-foreground">
            Share this code with a friend — they enter it on the booking page to unlock their reward, and you get yours when they attend.
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            {friend.map((b) => <Badge key={`f-${b}`} variant="secondary">Friend: {b}</Badge>)}
            {you.map((b) => <Badge key={`y-${b}`} variant="secondary">You: {b}</Badge>)}
          </div>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={share} disabled={!d.code} style={{ background: brand, color: "white" }}>
              <Share2 className="mr-2 h-4 w-4" /> Share
            </Button>
            <Button variant="outline" onClick={copy} disabled={!d.code}>
              <Copy className="mr-2 h-4 w-4" /> Copy code
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <Coins className="h-4 w-4" /> Credit
            </div>
            <div className="mt-1 font-serif text-2xl">{fmtRewardsGBP(d.creditPennies)}</div>
            <div className="mt-1 text-xs text-muted-foreground">Applied at your next booking</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-4 w-4" /> Points
            </div>
            <div className="mt-1 font-serif text-2xl">{d.points}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {s.points_redemption_enabled && s.points_per_pound_redeem
                ? `${s.points_per_pound_redeem} pts = £1`
                : "Earned across referrals"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center">
        <Link to="/m/$slug/rewards" params={{ slug }}>
          <Button variant="ghost" size="sm">See full details, tiers & FAQ <ArrowRight className="ml-1 h-4 w-4" /></Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your referrals</CardTitle>
          <CardDescription>Rewards pay out after your friend's first paid appointment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {d.referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No referrals yet — share your code to get started.</p>
          ) : d.referrals.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <div className="font-medium">
                  {r.reward_credit_pennies > 0 && `+${fmtRewardsGBP(r.reward_credit_pennies)}`}
                  {r.reward_credit_pennies > 0 && r.reward_points > 0 && " · "}
                  {r.reward_points > 0 && `+${r.reward_points} pts`}
                  {r.reward_credit_pennies === 0 && r.reward_points === 0 && "Referral"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                  {r.rewarded_at && ` · paid out ${new Date(r.rewarded_at).toLocaleDateString()}`}
                </div>
              </div>
              <Badge variant={r.status === "rewarded" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                {r.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

