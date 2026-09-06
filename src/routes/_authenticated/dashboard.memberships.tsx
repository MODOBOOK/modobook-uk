import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMembershipPlans,
  saveMembershipPlan,
  deleteMembershipPlan,
  listMemberships,
  setMembershipStatus,
  adjustPatientCredit,
  listMembershipInviteCandidates,
  inviteToMembershipPlan,
} from "@/lib/memberships.functions";
import { getMyTreatments } from "@/lib/treatments.functions";
import { getMyProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Pause, Play, XCircle, Crown, Wallet, Users, Mail, Search } from "lucide-react";
import { toast } from "sonner";
import { membershipsEnabled } from "@/lib/feature-flags";

export const Route = createFileRoute("/_authenticated/dashboard/memberships")({
  head: () => ({
    meta: [
      { title: "Memberships · MODO" },
      { name: "description", content: "Recurring patient membership plans, savings pots and member perks." },
    ],
  }),
  component: MembershipsPage,
});

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  interval: "month" | "year";
  credit_cents: number;
  spend_mode: "any" | "restricted" | "manual";
  eligible_treatment_ids: string[] | null;
  included_treatments: Array<{ treatment_id: string; quantity: number }>;
  discount_percent: number | null;
  perks: string | null;
  active: boolean;
};

type Member = {
  id: string;
  patient_name: string | null;
  patient_email: string | null;
  patient_user_id: string;
  status: string;
  current_period_end: string | null;
  created_at: string;
  membership_plans?: { name: string; price_cents: number; interval: string; credit_cents: number } | null;
};

const gbp = (cents: number) => `£${(cents / 100).toFixed(2)}`;

const emptyPlan: Omit<Plan, "id"> = {
  name: "",
  description: "",
  price_cents: 0,
  interval: "month",
  credit_cents: 0,
  spend_mode: "any",
  eligible_treatment_ids: [],
  included_treatments: [],
  discount_percent: null,
  perks: "",
  active: true,
};

function MembershipsPage() {
  const qc = useQueryClient();
  const listPlansFn = useServerFn(listMembershipPlans);
  const listMembersFn = useServerFn(listMemberships);
  const listT = useServerFn(getMyTreatments);
  const fetchProfile = useServerFn(getMyProfile);
  const saveFn = useServerFn(saveMembershipPlan);
  const delFn = useServerFn(deleteMembershipPlan);
  const statusFn = useServerFn(setMembershipStatus);
  const adjustFn = useServerFn(adjustPatientCredit);
  const candidatesFn = useServerFn(listMembershipInviteCandidates);
  const inviteFn = useServerFn(inviteToMembershipPlan);

  const plansQ = useQuery({ queryKey: ["membership-plans"], queryFn: () => listPlansFn() });
  const membersQ = useQuery({ queryKey: ["patient-memberships"], queryFn: () => listMembersFn() });
  const treatmentsQ = useQuery({ queryKey: ["treatments-for-memberships"], queryFn: () => listT() });
  const profileQ = useQuery({ queryKey: ["profile-for-memberships"], queryFn: () => fetchProfile() });

  const [editing, setEditing] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);
  const [adjustFor, setAdjustFor] = useState<Member | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [invitePlan, setInvitePlan] = useState<Plan | null>(null);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviting, setInviting] = useState(false);

  const candidatesQ = useQuery({
    queryKey: ["membership-invite-candidates"],
    queryFn: () => candidatesFn(),
    enabled: !!invitePlan,
  });
  const candidates = (candidatesQ.data ?? []) as Array<{ id: string; name: string; email: string }>;
  const filteredCandidates = candidates.filter((c) => {
    const q = inviteSearch.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.email.includes(q);
  });

  async function handleInvite() {
    if (!invitePlan) return;
    const extraEmails = inviteEmails
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
    if (inviteIds.length === 0 && extraEmails.length === 0) {
      toast.error("Pick at least one patient or add an email address.");
      return;
    }
    setInviting(true);
    try {
      const res = (await inviteFn({
        data: {
          planId: invitePlan.id,
          clientIds: inviteIds,
          extraEmails,
          message: inviteMessage.trim() || null,
        },
      })) as { sent: number; failed: string[] };
      toast.success(`Invitation sent to ${res.sent} patient${res.sent === 1 ? "" : "s"}`);
      if (res.failed.length) toast.error(`Couldn't send to ${res.failed.length} address(es)`);
      setInvitePlan(null);
      setInviteIds([]);
      setInviteEmails("");
      setInviteMessage("");
      setInviteSearch("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send invitations");
    } finally {
      setInviting(false);
    }
  }

  const plans = (plansQ.data ?? []) as unknown as Plan[];
  const members = (membersQ.data ?? []) as Member[];
  const treatments = ((treatmentsQ.data as { treatments?: Array<{ id: string; name: string }> } | undefined)?.treatments ??
    (Array.isArray(treatmentsQ.data) ? (treatmentsQ.data as Array<{ id: string; name: string }>) : [])) as Array<{ id: string; name: string }>;
  const slug = (profileQ.data as { slug?: string } | undefined)?.slug;
  const stripeConnected = !!(profileQ.data as { stripe_connect_account_id?: string | null } | undefined)?.stripe_connect_account_id;

  // Memberships are pilot-only: if the profile has loaded and this clinic
  // isn't in the pilot, don't render the manager (all server fns are also
  // gated, so nothing can be read or changed anyway).
  if (profileQ.data && !membershipsEnabled(slug ?? null)) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Crown className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Memberships</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Memberships aren't available for your clinic yet. We're trialling them
          with a small group first — they'll be switched on for everyone soon.
        </p>
      </div>
    );
  }


  const activeMembers = members.filter((m) => m.status === "active").length;
  const monthlyRecurring = members
    .filter((m) => m.status === "active")
    .reduce((s, m) => s + Number(m.membership_plans?.price_cents ?? 0), 0);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await saveFn({
        data: {
          id: editing.id,
          name: editing.name,
          description: editing.description,
          priceCents: editing.price_cents,
          interval: editing.interval,
          creditCents: editing.credit_cents,
          spendMode: editing.spend_mode,
          eligibleTreatmentIds: editing.eligible_treatment_ids ?? [],
          includedTreatments: editing.included_treatments,
          discountPercent: editing.discount_percent,
          perks: editing.perks,
          active: editing.active,
        },
      });
      toast.success("Plan saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["membership-plans"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save plan");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(id: string, action: "pause" | "resume" | "cancel") {
    if (action === "cancel" && !confirm("Cancel this membership? The patient's card will stop being charged.")) return;
    try {
      await statusFn({ data: { id, action } });
      toast.success(action === "cancel" ? "Membership cancelled" : action === "pause" ? "Membership paused" : "Membership resumed");
      qc.invalidateQueries({ queryKey: ["patient-memberships"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function handleAdjust() {
    if (!adjustFor) return;
    const pounds = Number(adjustAmount);
    if (!Number.isFinite(pounds) || pounds === 0) {
      toast.error("Enter an amount, e.g. 10 or -5");
      return;
    }
    try {
      await adjustFn({
        data: { patientUserId: adjustFor.patient_user_id, deltaCents: Math.round(pounds * 100), note: adjustNote },
      });
      toast.success("Credit adjusted");
      setAdjustFor(null);
      setAdjustAmount("");
      setAdjustNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Adjustment failed");
    }
  }

  function toggleId(list: string[], id: string) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Crown className="h-6 w-6" /> Memberships</h1>
          <p className="text-sm text-muted-foreground">
            Recurring plans your patients subscribe to by card. Their monthly payment builds a savings pot of credit
            they can spend on bookings with you.
          </p>
        </div>
        <Button
          className="shrink-0"
          onClick={() => { setEditing({ id: "", ...emptyPlan } as Plan); setOpen(true); }}
        >
          <Plus className="mr-1 h-4 w-4" /> <span className="sm:hidden">New</span><span className="hidden sm:inline">New plan</span>
        </Button>
      </div>

      {!stripeConnected && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-900">
            Connect your Stripe account (Payments &amp; payouts) before patients can subscribe to a plan.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card><CardContent className="py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> Active members</div>
          <div className="mt-1 text-2xl font-bold">{activeMembers}</div>
        </CardContent></Card>
        <Card><CardContent className="py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-3.5 w-3.5" /> Recurring / cycle</div>
          <div className="mt-1 text-2xl font-bold">{gbp(monthlyRecurring)}</div>
        </CardContent></Card>
        <Card className="col-span-2 sm:col-span-1"><CardContent className="py-4">
          <div className="text-xs text-muted-foreground">Patient sign-up page</div>
          {slug ? (
            <a
              href={`/m/${slug}/memberships`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate text-sm font-medium text-primary underline"
            >
              modobook.uk/m/{slug}/memberships
            </a>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">Set your clinic slug first</div>
          )}
        </CardContent></Card>
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plans ({plans.length})</TabsTrigger>
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-4 space-y-3">
          {plans.length === 0 && (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              No plans yet. Create one — e.g. “£50/month Skin Club” that adds £55 of credit each month.
            </CardContent></Card>
          )}
          {plans.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.name}</span>
                    {!p.active && <Badge variant="secondary">Hidden</Badge>}
                    <Badge variant="outline">{gbp(p.price_cents)}/{p.interval === "year" ? "yr" : "mo"}</Badge>
                    {p.credit_cents > 0 && (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        +{gbp(p.credit_cents)} credit
                      </Badge>
                    )}
                    {p.discount_percent ? <Badge variant="outline">{p.discount_percent}% member discount</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Credit spend: {p.spend_mode === "any" ? "any booking" : p.spend_mode === "restricted" ? `${(p.eligible_treatment_ids ?? []).length} selected treatments` : "manual — you apply it in clinic"}
                    {p.included_treatments.length > 0 && ` · Includes ${p.included_treatments.reduce((s, t) => s + t.quantity, 0)} treatment${p.included_treatments.length === 1 && p.included_treatments[0].quantity === 1 ? "" : "s"}/cycle`}
                  </p>
                  {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button size="sm" onClick={() => { setInvitePlan(p); setInviteIds([]); }} disabled={!p.active}>
                    <Mail className="mr-1 h-3.5 w-3.5" /> Invite patients
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditing(p); setOpen(true); }}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                  {p.active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!confirm("Hide this plan? Existing members keep their membership.")) return;
                        await delFn({ data: { id: p.id } });
                        toast.success("Plan hidden");
                        qc.invalidateQueries({ queryKey: ["membership-plans"] });
                      }}
                    >
                      Hide
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="members" className="mt-4 space-y-3">
          {members.length === 0 && (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              No members yet. Share your sign-up page link above.
            </CardContent></Card>
          )}
          {members.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{m.patient_name || m.patient_email || "Patient"}</span>
                    <Badge
                      variant={m.status === "active" ? "default" : "secondary"}
                      className={m.status === "past_due" ? "bg-red-100 text-red-800 hover:bg-red-100" : undefined}
                    >
                      {m.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline">{m.membership_plans?.name ?? "Plan"}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {m.patient_email}
                    {m.current_period_end && ` · renews ${new Date(m.current_period_end).toLocaleDateString("en-GB")}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAdjustFor(m)}>
                    <Wallet className="mr-1 h-3.5 w-3.5" /> Adjust credit
                  </Button>
                  {m.status === "active" && (
                    <Button variant="outline" size="sm" onClick={() => handleStatus(m.id, "pause")}>
                      <Pause className="mr-1 h-3.5 w-3.5" /> Pause
                    </Button>
                  )}
                  {m.status === "paused" && (
                    <Button variant="outline" size="sm" onClick={() => handleStatus(m.id, "resume")}>
                      <Play className="mr-1 h-3.5 w-3.5" /> Resume
                    </Button>
                  )}
                  {m.status !== "cancelled" && (
                    <Button variant="ghost" size="sm" onClick={() => handleStatus(m.id, "cancel")}>
                      <XCircle className="mr-1 h-3.5 w-3.5" /> Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Plan editor */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit plan" : "New membership plan"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Plan name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Skin Club"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description (shown to patients)</Label>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Monthly membership for regulars — priority booking, member pricing and a growing treatment pot."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Price (£)</Label>
                  <Input
                    type="number" min={1} step="0.01"
                    value={editing.price_cents ? editing.price_cents / 100 : ""}
                    onChange={(e) => setEditing({ ...editing, price_cents: Math.round(Number(e.target.value) * 100) })}
                    placeholder="50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Billed every</Label>
                  <Select
                    value={editing.interval}
                    onValueChange={(v) => setEditing({ ...editing, interval: v as "month" | "year" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Credit added to their pot each cycle (£)</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={editing.credit_cents ? editing.credit_cents / 100 : ""}
                  onChange={(e) => setEditing({ ...editing, credit_cents: Math.round(Number(e.target.value) * 100) })}
                  placeholder="55"
                />
                <p className="text-xs text-muted-foreground">
                  The patient's savings pot. Often set slightly above the price so membership feels rewarding (pay £50, get £55).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>What can they spend the pot on?</Label>
                <Select
                  value={editing.spend_mode}
                  onValueChange={(v) => setEditing({ ...editing, spend_mode: v as Plan["spend_mode"] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any booking</SelectItem>
                    <SelectItem value="restricted">Selected treatments only</SelectItem>
                    <SelectItem value="manual">Manual — I apply it in clinic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editing.spend_mode === "restricted" && (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="text-xs font-medium text-muted-foreground">Eligible treatments</div>
                  <div className="max-h-40 space-y-2 overflow-y-auto">
                    {treatments.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={(editing.eligible_treatment_ids ?? []).includes(t.id)}
                          onCheckedChange={() =>
                            setEditing({ ...editing, eligible_treatment_ids: toggleId(editing.eligible_treatment_ids ?? [], t.id) })
                          }
                        />
                        <span className="truncate">{t.name}</span>
                      </label>
                    ))}
                    {treatments.length === 0 && <p className="text-xs text-muted-foreground">No treatments yet.</p>}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Included treatments per cycle (optional)</Label>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                  {treatments.map((t) => {
                    const included = editing.included_treatments.find((x) => x.treatment_id === t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={!!included}
                          onCheckedChange={() =>
                            setEditing({
                              ...editing,
                              included_treatments: included
                                ? editing.included_treatments.filter((x) => x.treatment_id !== t.id)
                                : [...editing.included_treatments, { treatment_id: t.id, quantity: 1 }],
                            })
                          }
                        />
                        <span className="truncate">{t.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Member discount (% off bookings)</Label>
                  <Input
                    type="number" min={0} max={100}
                    value={editing.discount_percent ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, discount_percent: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    placeholder="10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Perks (one per line)</Label>
                  <Textarea
                    value={editing.perks ?? ""}
                    onChange={(e) => setEditing({ ...editing, perks: e.target.value })}
                    placeholder={"Priority booking\nFree skin reviews"}
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label className="cursor-pointer">Visible on your booking page</Label>
                <Switch
                  checked={editing.active}
                  onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !editing?.name.trim() || !editing.price_cents}>
              {saving ? "Saving…" : "Save plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust credit */}
      <Dialog open={!!adjustFor} onOpenChange={(o) => !o && setAdjustFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Adjust credit — {adjustFor?.patient_name || adjustFor?.patient_email}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Amount (£) — positive adds, negative removes</Label>
              <Input
                type="number" step="0.01"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="10 or -5"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="Goodwill top-up" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustFor(null)}>Cancel</Button>
            <Button onClick={handleAdjust}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite patients to a plan */}
      <Dialog open={!!invitePlan} onOpenChange={(o) => !o && setInvitePlan(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite patients to {invitePlan?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              Each patient gets an email with the plan details and a link to sign up and pay.
            </p>

            <div className="space-y-2">
              <Label>Your patients</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search by name or email"
                  value={inviteSearch}
                  onChange={(e) => setInviteSearch(e.target.value)}
                />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-md border">
                {candidatesQ.isLoading && (
                  <p className="p-3 text-sm text-muted-foreground">Loading patients…</p>
                )}
                {!candidatesQ.isLoading && filteredCandidates.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">No patients with an email address found.</p>
                )}
                {filteredCandidates.slice(0, 300).map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-0">
                    <Checkbox
                      checked={inviteIds.includes(c.id)}
                      onCheckedChange={(v) =>
                        setInviteIds((prev) => (v ? [...prev, c.id] : prev.filter((id) => id !== c.id)))
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                    </span>
                  </label>
                ))}
              </div>
              {inviteIds.length > 0 && (
                <p className="text-xs text-muted-foreground">{inviteIds.length} selected</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Other email addresses (optional)</Label>
              <Input
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                placeholder="name@example.com, another@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Personal note (optional)</Label>
              <Textarea
                rows={3}
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="I think this would suit you perfectly — it covers your regular skin treatments."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvitePlan(null)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? "Sending…" : "Send invitations"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
