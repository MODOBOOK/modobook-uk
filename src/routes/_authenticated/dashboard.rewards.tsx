import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  getMyReferralSettings,
  saveReferralSettings,
  getMyClinicReferrals,
} from "@/lib/rewards.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Gift, Sparkles, Coins, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/rewards")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Referrals & Rewards | MODO" }],
  }),
  component: RewardsSettingsPage,
});

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

  const [enabled, setEnabled] = useState(false);
  const [creditOn, setCreditOn] = useState(true);
  const [creditPounds, setCreditPounds] = useState<string>("20");
  const [pointsOn, setPointsOn] = useState(true);
  const [pointsValue, setPointsValue] = useState<string>("100");
  const [friendOn, setFriendOn] = useState(true);
  const [friendPounds, setFriendPounds] = useState<string>("10");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    const s = q.data;
    setEnabled(s.enabled);
    setCreditOn(s.referrer_credit_pennies > 0);
    setCreditPounds(String((s.referrer_credit_pennies || 2000) / 100));
    setPointsOn(s.referrer_points > 0);
    setPointsValue(String(s.referrer_points || 100));
    setFriendOn(s.friend_credit_pennies > 0);
    setFriendPounds(String((s.friend_credit_pennies || 1000) / 100));
    setHeadline(s.headline ?? "");
    setDescription(s.description ?? "");
  }, [q.data]);

  const referrerCreditPennies = creditOn ? Math.round(Number(creditPounds || 0) * 100) : 0;
  const referrerPoints = pointsOn ? Math.max(0, Math.floor(Number(pointsValue || 0))) : 0;
  const friendCreditPennies = friendOn ? Math.round(Number(friendPounds || 0) * 100) : 0;

  const nothingOn = !creditOn && !pointsOn && !friendOn;

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
          referrer_credit_pennies: referrerCreditPennies,
          referrer_points: referrerPoints,
          friend_credit_pennies: friendCreditPennies,
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
            Let happy patients bring friends. You choose the perks — money-off credit,
            loyalty points, or a discount for the new client — and rewards pay out
            automatically once the friend's first appointment is completed and paid.
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
              When off, patients don't see their code and no rewards can be earned.
            </CardDescription>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </CardHeader>
      </Card>

      <div className={enabled ? "space-y-4" : "pointer-events-none space-y-4 opacity-50"}>
        <RewardRow
          icon={<Coins className="h-5 w-5" />}
          title="Account credit for the referrer"
          hint="Money off their next booking with you. Recommended."
          on={creditOn}
          setOn={setCreditOn}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">£</span>
            <Input
              type="number"
              min="0"
              step="0.50"
              className="w-28"
              value={creditPounds}
              onChange={(e) => setCreditPounds(e.target.value)}
              disabled={!creditOn}
            />
            <span className="text-xs text-muted-foreground">per successful referral</span>
          </div>
        </RewardRow>

        <RewardRow
          icon={<Sparkles className="h-5 w-5" />}
          title="Loyalty points for the referrer"
          hint="Points accumulate — you can redeem them later for perks."
          on={pointsOn}
          setOn={setPointsOn}
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              step="10"
              className="w-28"
              value={pointsValue}
              onChange={(e) => setPointsValue(e.target.value)}
              disabled={!pointsOn}
            />
            <span className="text-xs text-muted-foreground">points per successful referral</span>
          </div>
        </RewardRow>

        <RewardRow
          icon={<Users className="h-5 w-5" />}
          title="Discount for the new client"
          hint="Two-sided rewards convert far better. Applied at their first booking."
          on={friendOn}
          setOn={setFriendOn}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">£</span>
            <Input
              type="number"
              min="0"
              step="0.50"
              className="w-28"
              value={friendPounds}
              onChange={(e) => setFriendPounds(e.target.value)}
              disabled={!friendOn}
            />
            <span className="text-xs text-muted-foreground">off their first booking</span>
          </div>
        </RewardRow>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What patients see</CardTitle>
            <CardDescription>Short pitch shown on their share screen.</CardDescription>
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
                placeholder="Share your code with friends. When they complete their first appointment, we'll add your reward automatically."
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
              "Share your code with friends. When they complete their first appointment, we'll add your reward automatically."}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {creditOn && referrerCreditPennies > 0 && (
              <li>• You get <strong>{fmtGBP(referrerCreditPennies)}</strong> credit off your next booking</li>
            )}
            {pointsOn && referrerPoints > 0 && (
              <li>• You earn <strong>{referrerPoints} points</strong> for your loyalty balance</li>
            )}
            {friendOn && friendCreditPennies > 0 && (
              <li>• Your friend gets <strong>{fmtGBP(friendCreditPennies)} off</strong> their first booking</li>
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
