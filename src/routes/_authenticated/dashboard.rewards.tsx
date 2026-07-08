import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  getMyReferralSettings,
  saveReferralSettings,
  getMyClinicReferrals,
  listMyRewardTiers,
  upsertRewardTier,
  deleteRewardTier,
  type RewardTier,
} from "@/lib/rewards.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Gift,
  Sparkles,
  Coins,
  Users,
  Loader2,
  Trophy,
  Plus,
  Trash2,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/rewards")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Referrals & Rewards | MODO" }],
  }),
  component: RewardsSettingsPage,
});

type CreditKind = "pennies" | "percent";

function fmtGBP(pennies: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pennies % 100 === 0 ? 0 : 2,
  }).format(pennies / 100);
}

function RewardsSettingsPage() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getMyReferralSettings);
  const save = useServerFn(saveReferralSettings);
  const fetchReferrals = useServerFn(getMyClinicReferrals);

  const q = useQuery({
    queryKey: ["my-referral-settings"],
    queryFn: () => fetchSettings(),
  });
  const referralsQ = useQuery({
    queryKey: ["my-clinic-referrals"],
    queryFn: () => fetchReferrals(),
  });

  // Main toggle
  const [enabled, setEnabled] = useState(false);
  const [showOnPublic, setShowOnPublic] = useState(false);

  // Referrer credit
  const [creditOn, setCreditOn] = useState(true);
  const [creditKind, setCreditKind] = useState<CreditKind>("pennies");
  const [creditPounds, setCreditPounds] = useState<string>("20");
  const [creditPercent, setCreditPercent] = useState<string>("10");

  // Referrer points (earned per successful referral)
  const [pointsOn, setPointsOn] = useState(true);
  const [pointsValue, setPointsValue] = useState<string>("100");

  // Friend discount
  const [friendOn, setFriendOn] = useState(true);
  const [friendKind, setFriendKind] = useState<CreditKind>("pennies");
  const [friendPounds, setFriendPounds] = useState<string>("10");
  const [friendPercent, setFriendPercent] = useState<string>("10");

  // Loyalty points system
  const [redeemOn, setRedeemOn] = useState(false);
  const [pointsPerPoundRedeem, setPointsPerPoundRedeem] = useState<string>("20");
  const [earnOn, setEarnOn] = useState(false);
  const [pointsPerPoundEarn, setPointsPerPoundEarn] = useState<string>("1");
  const [tiersOn, setTiersOn] = useState(false);

  // Copy
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    const s = q.data as any;
    setEnabled(s.enabled);
    setShowOnPublic(!!s.show_on_public_page);
    setCreditKind((s.referrer_credit_kind as CreditKind) ?? "pennies");
    setCreditOn(
      s.referrer_credit_kind === "percent"
        ? (s.referrer_credit_percent ?? 0) > 0
        : (s.referrer_credit_pennies ?? 0) > 0,
    );
    setCreditPounds(String((s.referrer_credit_pennies || 2000) / 100));
    setCreditPercent(String(s.referrer_credit_percent ?? 10));

    setPointsOn(s.referrer_points > 0);
    setPointsValue(String(s.referrer_points || 100));

    setFriendKind((s.friend_credit_kind as CreditKind) ?? "pennies");
    setFriendOn(
      s.friend_credit_kind === "percent"
        ? (s.friend_credit_percent ?? 0) > 0
        : (s.friend_credit_pennies ?? 0) > 0,
    );
    setFriendPounds(String((s.friend_credit_pennies || 1000) / 100));
    setFriendPercent(String(s.friend_credit_percent ?? 10));

    setRedeemOn(!!s.points_redemption_enabled);
    setPointsPerPoundRedeem(String(s.points_per_pound_redeem ?? 20));
    setEarnOn(!!s.earn_on_spend_enabled);
    setPointsPerPoundEarn(String(s.points_per_pound_earn ?? 1));
    setTiersOn(!!s.tiers_enabled);

    setHeadline(s.headline ?? "");
    setDescription(s.description ?? "");
  }, [q.data]);

  const referrerCreditPennies = creditOn && creditKind === "pennies"
    ? Math.round(Number(creditPounds || 0) * 100)
    : 0;
  const referrerCreditPercent = creditOn && creditKind === "percent"
    ? Math.max(0, Math.min(100, Math.floor(Number(creditPercent || 0))))
    : 0;
  const referrerPoints = pointsOn ? Math.max(0, Math.floor(Number(pointsValue || 0))) : 0;
  const friendCreditPennies = friendOn && friendKind === "pennies"
    ? Math.round(Number(friendPounds || 0) * 100)
    : 0;
  const friendCreditPercent = friendOn && friendKind === "percent"
    ? Math.max(0, Math.min(100, Math.floor(Number(friendPercent || 0))))
    : 0;

  const nothingOn = !creditOn && !pointsOn && !friendOn && !redeemOn && !earnOn && !tiersOn;

  async function onSave() {
    if (enabled && nothingOn) {
      toast.error("Turn on at least one reward, or disable the whole programme.");
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          enabled,
          referrer_credit_kind: creditKind,
          referrer_credit_pennies: referrerCreditPennies,
          referrer_credit_percent: referrerCreditPercent || 10,
          referrer_points: referrerPoints,
          friend_credit_kind: friendKind,
          friend_credit_pennies: friendCreditPennies,
          friend_credit_percent: friendCreditPercent || 10,
          points_redemption_enabled: redeemOn,
          points_per_pound_redeem: Math.max(1, Math.floor(Number(pointsPerPoundRedeem || 20))),
          earn_on_spend_enabled: earnOn,
          points_per_pound_earn: Math.max(0, Number(pointsPerPoundEarn || 1)),
          tiers_enabled: tiersOn,
          headline: headline.trim() || null,
          description: description.trim() || null,
        },
      });
      toast.success("Rewards updated");
      qc.invalidateQueries({ queryKey: ["my-referral-settings"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl">Referrals & Rewards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Let happy patients bring friends and earn loyalty perks. Every reward
            below can be toggled on or off independently.
          </p>
        </div>
        <Badge variant={enabled ? "default" : "outline"}>
          {enabled ? "Live" : "Off"}
        </Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Enable rewards programme</CardTitle>
            <CardDescription>
              Master switch. When off, nothing is earned, shown, or redeemable.
            </CardDescription>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </CardHeader>
      </Card>

      <div className={enabled ? "space-y-6" : "pointer-events-none space-y-6 opacity-50"}>
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Referral rewards
          </h2>

          <RewardRow
            icon={<Coins className="h-5 w-5" />}
            title="Reward for the referrer"
            hint="Money off their next booking with you — fixed £ or % off."
            on={creditOn}
            setOn={setCreditOn}
          >
            <div className="flex items-center gap-2">
              <Select
                value={creditKind}
                onValueChange={(v) => setCreditKind(v as CreditKind)}
                disabled={!creditOn}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pennies">£ off</SelectItem>
                  <SelectItem value="percent">% off</SelectItem>
                </SelectContent>
              </Select>
              {creditKind === "pennies" ? (
                <>
                  <span className="text-sm text-muted-foreground">£</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.50"
                    className="w-24"
                    value={creditPounds}
                    onChange={(e) => setCreditPounds(e.target.value)}
                    disabled={!creditOn}
                  />
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    className="w-24"
                    value={creditPercent}
                    onChange={(e) => setCreditPercent(e.target.value)}
                    disabled={!creditOn}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </>
              )}
            </div>
          </RewardRow>

          <RewardRow
            icon={<Sparkles className="h-5 w-5" />}
            title="Loyalty points for the referrer"
            hint="Points added to their balance for each successful referral."
            on={pointsOn}
            setOn={setPointsOn}
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="10"
                className="w-24"
                value={pointsValue}
                onChange={(e) => setPointsValue(e.target.value)}
                disabled={!pointsOn}
              />
              <span className="text-xs text-muted-foreground">points</span>
            </div>
          </RewardRow>

          <RewardRow
            icon={<Users className="h-5 w-5" />}
            title="Discount for the new client"
            hint="Applied to the friend's first booking — fixed £ or % off."
            on={friendOn}
            setOn={setFriendOn}
          >
            <div className="flex items-center gap-2">
              <Select
                value={friendKind}
                onValueChange={(v) => setFriendKind(v as CreditKind)}
                disabled={!friendOn}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pennies">£ off</SelectItem>
                  <SelectItem value="percent">% off</SelectItem>
                </SelectContent>
              </Select>
              {friendKind === "pennies" ? (
                <>
                  <span className="text-sm text-muted-foreground">£</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.50"
                    className="w-24"
                    value={friendPounds}
                    onChange={(e) => setFriendPounds(e.target.value)}
                    disabled={!friendOn}
                  />
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    className="w-24"
                    value={friendPercent}
                    onChange={(e) => setFriendPercent(e.target.value)}
                    disabled={!friendOn}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </>
              )}
            </div>
          </RewardRow>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Loyalty points
          </h2>

          <RewardRow
            icon={<ShoppingBag className="h-5 w-5" />}
            title="Earn points on every paid booking"
            hint="Patients build a points balance automatically as they spend with you."
            on={earnOn}
            setOn={setEarnOn}
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="0.5"
                className="w-24"
                value={pointsPerPoundEarn}
                onChange={(e) => setPointsPerPoundEarn(e.target.value)}
                disabled={!earnOn}
              />
              <span className="text-xs text-muted-foreground">points per £1 spent</span>
            </div>
          </RewardRow>

          <RewardRow
            icon={<Coins className="h-5 w-5" />}
            title="Redeem points as credit at checkout"
            hint="Patients trade points for £ off their next booking."
            on={redeemOn}
            setOn={setRedeemOn}
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                step="1"
                className="w-24"
                value={pointsPerPoundRedeem}
                onChange={(e) => setPointsPerPoundRedeem(e.target.value)}
                disabled={!redeemOn}
              />
              <span className="text-xs text-muted-foreground">points = £1</span>
            </div>
          </RewardRow>

          <RewardRow
            icon={<Trophy className="h-5 w-5" />}
            title="Rewards catalogue (tiers)"
            hint="Bigger perks patients can unlock — free add-ons, specific £ credit, custom prizes."
            on={tiersOn}
            setOn={setTiersOn}
          >
            <span className="text-xs text-muted-foreground">
              {tiersOn ? "Manage tiers below" : "Off"}
            </span>
          </RewardRow>

          {tiersOn && <TiersEditor pointsPerPoundRedeem={Number(pointsPerPoundRedeem) || 20} />}
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What patients see</CardTitle>
            <CardDescription>Short pitch shown on their rewards screen.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="headline">Headline</Label>
              <Input
                id="headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Refer a friend, treat yourself"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Share your code with friends and earn rewards as you go."
                maxLength={600}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Card className="border-primary/40 bg-primary/5">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <Gift className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">Live preview</CardTitle>
            <CardDescription>What appears on a patient's rewards screen.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="font-serif text-lg">
            {headline || "Refer a friend, treat yourself"}
          </p>
          <p className="text-sm text-muted-foreground">
            {description ||
              "Share your code with friends and earn rewards as you go."}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {creditOn && creditKind === "pennies" && referrerCreditPennies > 0 && (
              <li>• You get <strong>{fmtGBP(referrerCreditPennies)}</strong> credit off your next booking</li>
            )}
            {creditOn && creditKind === "percent" && referrerCreditPercent > 0 && (
              <li>• You get <strong>{referrerCreditPercent}% off</strong> your next booking</li>
            )}
            {pointsOn && referrerPoints > 0 && (
              <li>• You earn <strong>{referrerPoints} points</strong> per successful referral</li>
            )}
            {friendOn && friendKind === "pennies" && friendCreditPennies > 0 && (
              <li>• Your friend gets <strong>{fmtGBP(friendCreditPennies)} off</strong> their first booking</li>
            )}
            {friendOn && friendKind === "percent" && friendCreditPercent > 0 && (
              <li>• Your friend gets <strong>{friendCreditPercent}% off</strong> their first booking</li>
            )}
            {earnOn && (
              <li>• Earn <strong>{pointsPerPoundEarn} points</strong> for every £1 spent</li>
            )}
            {redeemOn && (
              <li>• Redeem <strong>{pointsPerPoundRedeem} points = £1</strong> at checkout</li>
            )}
            {tiersOn && (
              <li>• Unlock rewards from your points catalogue</li>
            )}
            {nothingOn && (
              <li className="text-muted-foreground italic">No rewards selected yet.</li>
            )}
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button onClick={onSave} disabled={saving || q.isLoading}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent referrals</CardTitle>
          <CardDescription>
            Bookings that came in via a patient's share link. Rewards settle
            automatically once the appointment is completed and paid.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referralsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (referralsQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No referrals yet. Share your patient rewards programme and they'll appear here.
            </p>
          ) : (
            <div className="divide-y">
              {(referralsQ.data ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {r.referred_email ?? "Referred patient"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Code {r.code} · {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {r.reward_credit_pennies > 0 && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                        {fmtGBP(r.reward_credit_pennies)} credit
                      </span>
                    )}
                    {r.reward_points > 0 && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                        {r.reward_points} pts
                      </span>
                    )}
                    <Badge variant={r.status === "rewarded" ? "default" : "outline"}>
                      {r.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RewardRow({
  icon,
  title,
  hint,
  on,
  setOn,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  on: boolean;
  setOn: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <p className="font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {children}
          <Switch checked={on} onCheckedChange={setOn} />
        </div>
      </CardContent>
    </Card>
  );
}

function TiersEditor({ pointsPerPoundRedeem: _ppr }: { pointsPerPoundRedeem: number }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyRewardTiers);
  const upsertFn = useServerFn(upsertRewardTier);
  const delFn = useServerFn(deleteRewardTier);

  const tiersQ = useQuery({
    queryKey: ["my-reward-tiers"],
    queryFn: () => listFn(),
  });

  const [draft, setDraft] = useState<Partial<RewardTier> & { reward_pounds?: string }>({
    label: "",
    points_cost: 500,
    reward_kind: "credit_pennies",
    reward_value: 1000,
    reward_pounds: "10",
    enabled: true,
    sort_order: 0,
  });
  const [busy, setBusy] = useState(false);

  async function addTier() {
    if (!draft.label || !draft.points_cost) {
      toast.error("Add a label and points cost");
      return;
    }
    setBusy(true);
    try {
      const rewardValue =
        draft.reward_kind === "credit_pennies"
          ? Math.round(Number(draft.reward_pounds || 0) * 100)
          : (draft.reward_value ?? 0);
      await upsertFn({
        data: {
          label: draft.label!,
          points_cost: Number(draft.points_cost),
          reward_kind: (draft.reward_kind ?? "credit_pennies") as RewardTier["reward_kind"],
          reward_value: rewardValue,
          description: draft.description ?? null,
          enabled: draft.enabled ?? true,
          sort_order: draft.sort_order ?? 0,
        },
      });
      toast.success("Tier added");
      setDraft({
        label: "",
        points_cost: 500,
        reward_kind: "credit_pennies",
        reward_value: 1000,
        reward_pounds: "10",
        enabled: true,
        sort_order: 0,
      });
      qc.invalidateQueries({ queryKey: ["my-reward-tiers"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleTier(t: RewardTier) {
    await upsertFn({
      data: {
        id: t.id,
        label: t.label,
        points_cost: t.points_cost,
        reward_kind: t.reward_kind,
        reward_value: t.reward_value,
        description: t.description,
        enabled: !t.enabled,
        sort_order: t.sort_order,
      },
    });
    qc.invalidateQueries({ queryKey: ["my-reward-tiers"] });
  }

  async function removeTier(id: string) {
    if (!confirm("Delete this tier?")) return;
    await delFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["my-reward-tiers"] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rewards catalogue</CardTitle>
        <CardDescription>
          Add point-cost rewards patients can unlock. Toggle individual tiers on/off.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tiersQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (tiersQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No tiers yet.</p>
        ) : (
          <div className="divide-y rounded-md border">
            {(tiersQ.data ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.points_cost} pts →{" "}
                    {t.reward_kind === "credit_pennies"
                      ? `${fmtGBP(t.reward_value)} credit`
                      : t.reward_kind === "free_addon"
                        ? "Free add-on"
                        : "Custom reward"}
                    {t.description ? ` · ${t.description}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={t.enabled} onCheckedChange={() => toggleTier(t)} />
                  <Button variant="ghost" size="icon" onClick={() => removeTier(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <p className="text-sm font-medium">Add a tier</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input
                value={draft.label ?? ""}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="Free add-on"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Points cost</Label>
              <Input
                type="number"
                min="1"
                value={draft.points_cost ?? 0}
                onChange={(e) =>
                  setDraft({ ...draft, points_cost: Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reward kind</Label>
              <Select
                value={draft.reward_kind ?? "credit_pennies"}
                onValueChange={(v) =>
                  setDraft({ ...draft, reward_kind: v as RewardTier["reward_kind"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_pennies">£ credit</SelectItem>
                  <SelectItem value="free_addon">Free add-on</SelectItem>
                  <SelectItem value="custom">Custom (contact clinic)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.reward_kind === "credit_pennies" ? (
              <div className="space-y-1.5">
                <Label>Credit amount (£)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.50"
                  value={draft.reward_pounds ?? "0"}
                  onChange={(e) => setDraft({ ...draft, reward_pounds: e.target.value })}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Notes for patient</Label>
                <Input
                  value={draft.description ?? ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="e.g. Free lip balm"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={addTier} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add tier
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
