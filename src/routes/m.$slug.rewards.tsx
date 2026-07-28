import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicRewardsOverview, type RewardTier } from "@/lib/rewards.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Gift, Sparkles, Trophy } from "lucide-react";

export const Route = createFileRoute("/m/$slug/rewards")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Rewards | MODO" }],
  }),
  component: RewardsPage,
});

function fmtGBP(pennies: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pennies % 100 === 0 ? 0 : 2,
  }).format(pennies / 100);
}

function describeReferrerReward(s: any): string | null {
  if (!s) return null;
  const parts: string[] = [];
  if (s.referrer_credit_kind === "percent" && s.referrer_credit_percent > 0)
    parts.push(`${s.referrer_credit_percent}% off your next booking`);
  else if (s.referrer_credit_pennies > 0)
    parts.push(`${fmtGBP(s.referrer_credit_pennies)} credit`);
  if (s.referrer_points > 0) parts.push(`${s.referrer_points} loyalty points`);
  return parts.length ? parts.join(" + ") : null;
}

function describeFriendReward(s: any): string | null {
  if (!s) return null;
  if (s.friend_credit_kind === "percent" && s.friend_credit_percent > 0)
    return `${s.friend_credit_percent}% off their first booking`;
  if (s.friend_credit_pennies > 0)
    return `${fmtGBP(s.friend_credit_pennies)} off their first booking`;
  return null;
}

function RewardsPage() {
  const { slug } = useParams({ from: "/m/$slug/rewards" });
  const fetchPublic = useServerFn(getPublicRewardsOverview);

  const publicQ = useQuery({
    queryKey: ["public-rewards", slug],
    queryFn: () => fetchPublic({ data: { slug } }),
  });

  if (publicQ.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  const pub = publicQ.data;
  const s = pub?.visible ? (pub.settings as any) : null;
  const tiers = pub?.visible ? pub.tiers : [];
  const clinicName = pub?.visible ? pub.clinic.name : "Clinic";

  if (!s?.enabled) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-16 text-center">
        <h1 className="font-serif text-2xl">Rewards</h1>
        <p className="text-sm text-muted-foreground">
          {clinicName} isn't running a rewards programme right now.
        </p>
        <Link to="/m/$slug" params={{ slug }}>
          <Button variant="ghost" size="sm">Back to clinic</Button>
        </Link>
      </div>
    );
  }

  const earnRate = s.earn_on_spend_enabled && s.points_per_pound_earn > 0 ? Number(s.points_per_pound_earn) : 0;
  const redeemRate = s.points_redemption_enabled && s.points_per_pound_redeem ? Number(s.points_per_pound_redeem) : 0;
  const friend = describeFriendReward(s);
  const you = describeReferrerReward(s);

  const ways: { icon: typeof Gift; title: string; body: string }[] = [];
  if (earnRate > 0) {
    ways.push({
      icon: Sparkles,
      title: "Earn every time you book",
      body: `Collect ${earnRate} point${earnRate === 1 ? "" : "s"} for every £1 you spend. Points are added automatically once your appointment is paid — nothing to claim.`,
    });
  }
  if (friend || you) {
    ways.push({
      icon: Gift,
      title: "Earn for referring a friend",
      body: `${friend ? `Your friend gets ${friend}. ` : ""}${you ? `You get ${you} once they've had their first paid appointment.` : "You're rewarded once they've had their first paid appointment."}`,
    });
  }
  if (redeemRate > 0) {
    ways.push({
      icon: Trophy,
      title: "Spend your points on treatments",
      body: `${redeemRate} points = £1 off. At checkout, enter your own code in the "Promo or gift card code" box and we'll take the maximum off your total.`,
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-10">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Gift className="h-7 w-7" />
        </div>
        <h1 className="font-serif text-2xl">{s.headline || "Earn points every visit"}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {s.description ||
            `Every booking with ${clinicName} earns you points${redeemRate ? " you can put straight towards your next treatment" : ""}. Refer a friend and you'll earn even more.`}
        </p>
      </div>

      <div className="space-y-3">
        {ways.map((w) => (
          <Card key={w.title}>
            <CardContent className="flex gap-3 p-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <w.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">{w.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{w.body}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tiers.length > 0 && <TiersCard tiers={tiers} settings={s} />}

      <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="space-y-3 p-6 text-center">
          <p className="font-serif text-lg">Your points live in your account</p>
          <p className="text-sm text-muted-foreground">
            Sign in to see your balance and your personal code — then apply it at checkout to take
            your points off the price.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/m/$slug/account" params={{ slug }}>
              <Button variant="outline">View my points</Button>
            </Link>
            <Link to="/m/$slug" params={{ slug }}>
              <Button>Book now</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Separator />
      <div className="text-center">
        <Link to="/m/$slug" params={{ slug }}>
          <Button variant="ghost" size="sm">Back to clinic</Button>
        </Link>
      </div>
    </div>
  );
}

function TiersCard({ tiers, settings }: { tiers: RewardTier[]; settings: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" /> Rewards you can unlock
        </CardTitle>
        {settings?.points_per_pound_redeem && (
          <CardDescription>{settings.points_per_pound_redeem} points = £1 equivalent value.</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {tiers.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium">{t.label}</div>
              {t.description && (
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{t.description}</div>
              )}
              {t.reward_kind === "credit_pennies" && t.reward_value > 0 && (
                <div className="mt-0.5 text-xs text-muted-foreground">Worth {fmtGBP(t.reward_value)}</div>
              )}
            </div>
            <Badge variant="secondary" className="shrink-0">{t.points_cost.toLocaleString()} pts</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

