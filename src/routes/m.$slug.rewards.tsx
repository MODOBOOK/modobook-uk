import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getMyRewardsForClinic } from "@/lib/rewards.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Gift, Copy, Share2, Sparkles, Coins, Loader2 } from "lucide-react";
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

function RewardsPage() {
  const { slug } = useParams({ from: "/m/$slug/rewards" });
  const fetchRewards = useServerFn(getMyRewardsForClinic);
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  // Guard sign-in ourselves (this route is public).
  useState(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setAuthChecked(true);
    });
  });

  const q = useQuery({
    queryKey: ["my-rewards", slug],
    queryFn: () => fetchRewards({ data: { slug } }),
    enabled: signedIn,
  });

  if (!authChecked) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!signedIn) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Gift className="h-6 w-6" />
            </div>
            <CardTitle>Sign in to see your rewards</CardTitle>
            <CardDescription>
              You need an account with this clinic to view your referral code and balance.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-2">
            <Link to="/m/$slug/auth" params={{ slug }} search={{ redirect: `/m/${slug}/rewards` } as any}>
              <Button>Sign in</Button>
            </Link>
            <Link to="/m/$slug" params={{ slug }}>
              <Button variant="ghost">Back</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (q.isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading rewards…</div>;
  }
  if (q.error) {
    return <div className="p-8 text-center text-sm text-destructive">{(q.error as Error).message}</div>;
  }

  const data = q.data!;
  const s = data.settings;
  const enabled = !!s?.enabled;

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
            (enabled
              ? "Share your code with friends. When they complete their first appointment, we'll add your reward automatically."
              : `${data.clinic.name} hasn't turned on their rewards programme yet — check back soon.`)}
        </p>
      </div>

      {!enabled ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Rewards aren't currently offered by this clinic.
          </CardContent>
        </Card>
      ) : (
        <>
          <ShareCard code={data.code} slug={slug} settings={s} />

          <div className="grid grid-cols-2 gap-3">
            <BalanceCard
              icon={<Coins className="h-4 w-4" />}
              label="Credit balance"
              value={fmtGBP(data.creditPennies)}
              hint="Applied at your next booking"
            />
            <BalanceCard
              icon={<Sparkles className="h-4 w-4" />}
              label="Loyalty points"
              value={String(data.points)}
              hint="Earned across referrals"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your referrals</CardTitle>
              <CardDescription>Rewards pay out after your friend's first paid appointment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.referrals.length === 0 && (
                <p className="text-sm text-muted-foreground">No referrals yet — share your code to get started.</p>
              )}
              {data.referrals.map((r) => (
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
      )}

      <Separator />
      <div className="text-center">
        <Link to="/m/$slug/account" params={{ slug }}>
          <Button variant="ghost" size="sm">Back to my account</Button>
        </Link>
      </div>
    </div>
  );
}

function ShareCard({
  code,
  slug,
  settings,
}: {
  code: string | null;
  slug: string;
  settings: { referrer_credit_pennies: number; referrer_points: number; friend_credit_pennies: number } | null;
}) {
  const shareUrl = code ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${code}` : "";

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — long-press to select");
    }
  }

  async function share() {
    if (!shareUrl) return;
    const text = settings?.friend_credit_pennies
      ? `Get ${fmtGBP(settings.friend_credit_pennies)} off your first booking with my referral code:`
      : "Book with my referral code:";
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: "Referral", text, url: shareUrl });
        return;
      } catch {
        // fall through to copy
      }
    }
    copy();
  }

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5">
      <CardContent className="space-y-4 p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Your referral code</p>
        <p className="font-serif text-4xl tracking-widest">
          {code ?? <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
        </p>
        {settings && (
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            {settings.referrer_credit_pennies > 0 && (
              <Badge variant="secondary">You: {fmtGBP(settings.referrer_credit_pennies)} credit</Badge>
            )}
            {settings.referrer_points > 0 && (
              <Badge variant="secondary">You: {settings.referrer_points} pts</Badge>
            )}
            {settings.friend_credit_pennies > 0 && (
              <Badge variant="secondary">Friend: {fmtGBP(settings.friend_credit_pennies)} off</Badge>
            )}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={share} disabled={!code}>
            <Share2 className="mr-2 h-4 w-4" /> Share link
          </Button>
          <Button variant="outline" onClick={copy} disabled={!code}>
            <Copy className="mr-2 h-4 w-4" /> Copy link
          </Button>
        </div>
        {code && <p className="text-xs text-muted-foreground break-all">{shareUrl}</p>}
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
