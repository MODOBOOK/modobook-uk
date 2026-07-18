import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicRewardsOverview } from "@/lib/rewards.functions";
import { Gift, Sparkles, ArrowRight, Trophy } from "lucide-react";

function fmtGBP(pennies: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pennies % 100 === 0 ? 0 : 2,
  }).format(pennies / 100);
}

export function PublicRewardsBanner({ slug, brand }: { slug: string; brand?: string | null }) {
  const fetchPublic = useServerFn(getPublicRewardsOverview);
  const q = useQuery({
    queryKey: ["public-rewards-banner", slug],
    queryFn: () => fetchPublic({ data: { slug } }),
    staleTime: 60_000,
  });

  if (!q.data || q.data.visible !== true) return null;
  const s = q.data.settings as any;
  const tiers = q.data.tiers;

  const friendBits: string[] = [];
  if (s?.friend_credit_kind === "percent" && s.friend_credit_percent > 0)
    friendBits.push(`${s.friend_credit_percent}% off first booking`);
  else if (s?.friend_credit_pennies > 0)
    friendBits.push(`${fmtGBP(s.friend_credit_pennies)} off first booking`);

  const referBits: string[] = [];
  if (s?.referrer_credit_kind === "percent" && s.referrer_credit_percent > 0)
    referBits.push(`${s.referrer_credit_percent}% off for you`);
  else if (s?.referrer_credit_pennies > 0)
    referBits.push(`${fmtGBP(s.referrer_credit_pennies)} credit`);
  if (s?.referrer_points > 0) referBits.push(`${s.referrer_points} pts`);

  const earn = s?.earn_on_spend_enabled && s.points_per_pound_earn > 0
    ? `Earn ${s.points_per_pound_earn} pt${s.points_per_pound_earn === 1 ? "" : "s"} per £1`
    : null;

  const accent = brand || "#1f2937";

  return (
    <section className="mx-auto mt-8 max-w-3xl px-4">
      <div
        className="overflow-hidden rounded-2xl border shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${accent}15, ${accent}05)`,
          borderColor: `${accent}30`,
        }}
      >
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                style={{ background: `${accent}20`, color: accent }}
              >
                <Gift className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
                  Rewards & referrals
                </div>
                <h3 className="mt-0.5 text-lg font-semibold sm:text-xl">
                  {s?.headline || "Refer a friend, treat yourself"}
                </h3>
                {s?.description && (
                  <p className="mt-1 max-w-lg text-sm text-muted-foreground">{s.description}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/m/$slug/rewards" params={{ slug }}>
                <button
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-muted"
                  style={{ borderColor: `${accent}30`, color: accent }}
                >
                  How it works
                </button>
              </Link>
              <Link to="/m/$slug/rewards" params={{ slug }}>
                <button
                  className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
                  style={{ background: accent }}
                >
                  See details <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {friendBits.map((b) => (
              <span key={`f-${b}`} className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 font-medium">
                <Sparkles className="h-3 w-3" /> Friend: {b}
              </span>
            ))}
            {referBits.map((b) => (
              <span key={`r-${b}`} className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 font-medium">
                <Gift className="h-3 w-3" /> You: {b}
              </span>
            ))}
            {earn && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 font-medium">
                <Sparkles className="h-3 w-3" /> {earn}
              </span>
            )}
            {tiers.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 font-medium">
                <Trophy className="h-3 w-3" /> {tiers.length} reward{tiers.length === 1 ? "" : "s"} to unlock
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
