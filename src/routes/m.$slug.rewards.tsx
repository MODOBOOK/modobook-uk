import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getMyRewardsForClinic, getPublicRewardsOverview, type RewardTier } from "@/lib/rewards.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Gift, Copy, Share2, Sparkles, Coins, Loader2, Trophy, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/m/$slug/rewards")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Refer & earn | MODO" }],
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
  const fetchRewards = useServerFn(getMyRewardsForClinic);
  const fetchPublic = useServerFn(getPublicRewardsOverview);
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setAuthChecked(true);
    });
  }, []);

  const publicQ = useQuery({
    queryKey: ["public-rewards", slug],
    queryFn: () => fetchPublic({ data: { slug } }),
  });

  const myQ = useQuery({
    queryKey: ["my-rewards", slug],
    queryFn: () => fetchRewards({ data: { slug } }),
    enabled: signedIn,
  });

  if (!authChecked || publicQ.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  const pub = publicQ.data;
  const my = myQ.data;
  // Prefer the signed-in view's settings (accurate for the patient) but fall
  // back to the public overview so the marketing view still renders.
  const s = (my?.settings ?? (pub?.visible ? pub.settings : null)) as any;
  const enabled = !!s?.enabled;
  const publiclyVisible = pub?.visible === true;
  const tiers = pub?.visible ? pub.tiers : [];
  const clinicName = my?.clinic.name ?? (pub?.visible ? pub.clinic.name : "Clinic");

  // If the clinic hasn't turned rewards on OR hasn't opted to show them
  // publicly, don't advertise the programme here at all.
  if (!enabled || !publiclyVisible) {
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

      <>
          {/* How the whole scheme works — plain-English explainer */}
          <HowItWorksCard settings={s} tiersCount={tiers.length} clinicName={clinicName} />

          {/* Public marketing overview — visible to everyone, signed in or not */}
          <RewardsOverviewCard settings={s} />

          {tiers.length > 0 && <TiersCard tiers={tiers} settings={s} />}

          <FaqCard settings={s} />

          {/* Personal share / balance / history — signed-in only */}
          {signedIn && my ? (
            <>
              <ShareCard code={my.code} slug={slug} settings={s} />

              <div className="grid grid-cols-2 gap-3">
                <BalanceCard
                  icon={<Coins className="h-4 w-4" />}
                  label="Credit balance"
                  value={fmtGBP(my.creditPennies)}
                  hint="Applied at your next booking"
                />
                <BalanceCard
                  icon={<Sparkles className="h-4 w-4" />}
                  label="Loyalty points"
                  value={String(my.points)}
                  hint={
                    s?.points_redemption_enabled && s.points_per_pound_redeem
                      ? `${s.points_per_pound_redeem} pts = £1`
                      : "Earned across referrals"
                  }
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Your referrals</CardTitle>
                  <CardDescription>
                    Rewards pay out after your friend's first paid appointment.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {my.referrals.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No referrals yet — share your code to get started.
                    </p>
                  )}
                  {my.referrals.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                      <div>
                        <p className="font-medium">
                          {r.reward_credit_pennies > 0 && `+${fmtGBP(r.reward_credit_pennies)}`}
                          {r.reward_credit_pennies > 0 && r.reward_points > 0 && " · "}
                          {r.reward_points > 0 && `+${r.reward_points} pts`}
                          {r.reward_credit_pennies === 0 && r.reward_points === 0 && "Referral"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                          {r.rewarded_at && ` · paid out ${new Date(r.rewarded_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border-primary/40">
              <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Sign in to get your personal referral code and start earning.
                </p>
                <Link to="/m/$slug/auth" params={{ slug }} search={{ redirect: `/m/${slug}/rewards` } as any}>
                  <Button>Sign in to start earning</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Separator />
      <div className="text-center">
        <Link to="/m/$slug" params={{ slug }}>
          <Button variant="ghost" size="sm">Back to clinic</Button>
        </Link>
      </div>
    </div>
  );
}

function RewardsOverviewCard({ settings }: { settings: any }) {
  const you = describeReferrerReward(settings);
  const friend = describeFriendReward(settings);
  const earn = settings?.earn_on_spend_enabled && settings.points_per_pound_earn > 0
    ? `Earn ${settings.points_per_pound_earn} point${settings.points_per_pound_earn === 1 ? "" : "s"} per £1 spent on treatments.`
    : null;
  const redeem = settings?.points_redemption_enabled && settings.points_per_pound_redeem
    ? `Redeem ${settings.points_per_pound_redeem} points for £1 off.`
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
    items.push({ q: "How do I redeem my points?", a: `${settings.points_per_pound_redeem} points = £1 off. Your balance is applied automatically at checkout — no code needed.` });
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

function ShareCard({
  code,
  slug,
  settings,
}: {
  code: string | null;
  slug: string;
  settings: any;
}) {
  const shareText = code
    ? (() => {
        const friend = describeFriendReward(settings);
        const perk = friend ? ` They'll get ${friend}.` : "";
        return `Book with them and use my referral code ${code} at checkout.${perk}`;
      })()
    : "";

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch {
      toast.error("Couldn't copy — long-press to select");
    }
  }

  async function share() {
    if (!code) return;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: "Referral code", text: shareText });
        return;
      } catch {
        // fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Message copied — paste it to your friend");
    } catch {
      toast.error("Couldn't copy");
    }
    void slug;
  }

  const youLabel = describeReferrerReward(settings);
  const friendLabel = describeFriendReward(settings);

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5">
      <CardContent className="space-y-4 p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Your referral code</p>
        <p className="font-serif text-4xl tracking-widest">
          {code ?? <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
        </p>
        <p className="text-xs text-muted-foreground">
          Give this code to a friend. They enter it on the booking page — you both get rewarded when they attend.
        </p>
        {(youLabel || friendLabel) && (
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            {youLabel && <Badge variant="secondary">You: {youLabel}</Badge>}
            {friendLabel && <Badge variant="secondary">Friend: {friendLabel}</Badge>}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={share} disabled={!code}>
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
          <Button variant="outline" onClick={copy} disabled={!code}>
            <Copy className="mr-2 h-4 w-4" /> Copy code
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BalanceCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          {icon} {label}
        </div>
        <p className="mt-1 font-serif text-2xl">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { v: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { v: "secondary", label: "Pending" },
    rewarded: { v: "default", label: "Rewarded" },
    rejected: { v: "destructive", label: "Rejected" },
  };
  const m = map[status] ?? { v: "outline" as const, label: status };
  return <Badge variant={m.v}>{m.label}</Badge>;
}
