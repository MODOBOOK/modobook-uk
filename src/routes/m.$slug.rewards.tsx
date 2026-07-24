import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicRewardsOverview, type RewardTier } from "@/lib/rewards.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Gift, Sparkles, Trophy, HelpCircle } from "lucide-react";

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

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Gift className="h-7 w-7" />
        </div>
        <h1 className="font-serif text-2xl">
          {s?.headline || "Refer a friend, treat yourself"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {s?.description ||
            "Share your code with friends. When they complete their first appointment, we'll add your reward automatically."}
        </p>
      </div>

      <HowItWorksCard settings={s} tiersCount={tiers.length} clinicName={clinicName} />
      <RewardsOverviewCard settings={s} />
      {tiers.length > 0 && <TiersCard tiers={tiers} settings={s} />}
      <FaqCard settings={s} />

      <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="space-y-3 p-6 text-center">
          <p className="font-serif text-lg">Have a code?</p>
          <p className="text-sm text-muted-foreground">
            Enter your personal referral code — or a friend's — in the “Promo or gift card code” box when you book. Points redeem at checkout automatically.
          </p>
          <Link to="/m/$slug" params={{ slug }}>
            <Button>Book now</Button>
          </Link>
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

function HowItWorksCard({
  settings,
  tiersCount,
  clinicName,
}: {
  settings: any;
  tiersCount: number;
  clinicName: string;
}) {
  const hasReferrals =
    (settings?.referrer_credit_pennies ?? 0) > 0 ||
    (settings?.referrer_credit_percent ?? 0) > 0 ||
    (settings?.referrer_points ?? 0) > 0 ||
    (settings?.friend_credit_pennies ?? 0) > 0 ||
    (settings?.friend_credit_percent ?? 0) > 0;
  const hasEarn = !!settings?.earn_on_spend_enabled && settings?.points_per_pound_earn > 0;
  const hasRedeem = !!settings?.points_redemption_enabled && settings?.points_per_pound_redeem;

  const steps: { title: string; body: string }[] = [];
  if (hasReferrals) {
    steps.push({
      title: "1. Share your code",
      body: `Sign in to see your personal referral code. Send it to friends however you like — text, WhatsApp, Instagram. They enter it on the ${clinicName} booking page.`,
    });
    steps.push({
      title: "2. They book and attend",
      body: "Your friend's welcome discount is applied automatically at checkout. Once they complete and pay for their first appointment, both of your rewards are unlocked.",
    });
  }
  if (hasEarn) {
    steps.push({
      title: `${steps.length + 1}. Earn on every visit`,
      body: `You collect ${settings.points_per_pound_earn} point${settings.points_per_pound_earn === 1 ? "" : "s"} for every £1 you spend on treatments. Points post automatically after your appointment is paid.`,
    });
  }
  if (hasRedeem) {
    steps.push({
      title: `${steps.length + 1}. Redeem your points`,
      body: `${settings.points_per_pound_redeem} points = £1 off. When you book, enter your personal referral code in the promo/gift card box at checkout and your points balance is applied automatically — no separate voucher needed.${
        tiersCount > 0 ? " You can also cash points in for the reward tiers listed below." : ""
      }`,
    });
  } else if (tiersCount > 0) {
    steps.push({
      title: `${steps.length + 1}. Unlock rewards`,
      body: "Save up your points and swap them for the reward tiers below when you're ready.",
    });
  }

  if (steps.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" /> How the programme works
        </CardTitle>
        <CardDescription>
          Everything happens automatically — no forms, no chasing. Rewards land in your account as soon as they're earned.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {steps.map((step) => (
          <div key={step.title} className="rounded-md border bg-muted/30 p-3">
            <div className="font-medium">{step.title}</div>
            <p className="mt-1 text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}


function RewardsOverviewCard({ settings }: { settings: any }) {
  const you = describeReferrerReward(settings);
  const friend = describeFriendReward(settings);
  const earn = settings?.earn_on_spend_enabled && settings.points_per_pound_earn > 0
    ? `Earn ${settings.points_per_pound_earn} point${settings.points_per_pound_earn === 1 ? "" : "s"} per £1 spent on treatments.`
    : null;
  const redeem = settings?.points_redemption_enabled && settings.points_per_pound_redeem
    ? `Redeem ${settings.points_per_pound_redeem} points for £1 off — apply at checkout with your own code.`
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" /> How it works
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {friend && (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="font-medium">For your friend</div>
            <p className="text-muted-foreground">{friend}</p>
          </div>
        )}
        {you && (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="font-medium">For you</div>
            <p className="text-muted-foreground">{you}, when they complete their first paid appointment.</p>
          </div>
        )}
        {(earn || redeem) && (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="font-medium">Loyalty points</div>
            {earn && <p className="text-muted-foreground">{earn}</p>}
            {redeem && <p className="text-muted-foreground">{redeem}</p>}
          </div>
        )}
        {!you && !friend && !earn && !redeem && (
          <p className="text-muted-foreground">Ask your practitioner about their rewards programme.</p>
        )}
      </CardContent>
    </Card>
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

function FaqCard({ settings }: { settings: any }) {
  const items: { q: string; a: string }[] = [];
  const friend = describeFriendReward(settings);
  const you = describeReferrerReward(settings);
  if (friend) items.push({ q: "How does referring a friend work?", a: `Share your personal link with a friend. When they book and complete their first paid appointment using it, they get ${friend} and you earn ${you || "your reward"}.` });
  if (settings?.earn_on_spend_enabled && settings.points_per_pound_earn > 0) {
    items.push({ q: "How do I earn points?", a: `You earn ${settings.points_per_pound_earn} point${settings.points_per_pound_earn === 1 ? "" : "s"} for every £1 spent on treatments${settings.referrer_points > 0 ? `, plus ${settings.referrer_points} points each time a friend you referred completes their first appointment.` : "."}` });
  } else if (settings?.referrer_points > 0) {
    items.push({ q: "How do I earn points?", a: `You earn ${settings.referrer_points} points each time a friend you referred completes their first paid appointment.` });
  }
  if (settings?.points_redemption_enabled && settings.points_per_pound_redeem) {
    items.push({ q: "How do I redeem my points?", a: `${settings.points_per_pound_redeem} points = £1 off. When you book, enter your own personal referral code in the promo/gift card code box — we'll apply the maximum available balance to your total automatically.` });
  }
  items.push({ q: "When do rewards pay out?", a: "Automatically after the qualifying appointment is completed and paid. You'll see them in your account here." });
  items.push({ q: "Do rewards expire?", a: "Contact your practitioner directly for anything specific to your account — they can help with expiry, balance queries, or manual adjustments." });

  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HelpCircle className="h-4 w-4" /> Common questions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {items.map((it, i) => (
          <div key={i}>
            <div className="font-medium">{it.q}</div>
            <p className="mt-0.5 text-muted-foreground">{it.a}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
