import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyReferralProgramme } from "@/lib/practitioner-referrals.functions";
import { getMyProfile } from "@/lib/profiles.functions";
import { practitionerReferralsEnabled } from "@/lib/feature-flags";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Gift, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/referrals")({
  component: ReferralsPage,
});

type Programme = Awaited<ReturnType<typeof getMyReferralProgramme>>;

function ReferralsPage() {
  const fetchProgramme = useServerFn(getMyReferralProgramme);
  const fetchProfile = useServerFn(getMyProfile);
  const [data, setData] = useState<Programme | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const p = await fetchProfile();
      const s = (p as { slug?: string | null } | null)?.slug ?? null;
      setSlug(s);
      if (practitionerReferralsEnabled(s)) {
        try {
          setData(await fetchProgramme());
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not load referrals");
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!practitionerReferralsEnabled(slug)) {
    return (
      <div className="mx-auto max-w-xl space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Refer a practitioner</h1>
        <p className="text-sm text-muted-foreground">
          The referral programme is coming soon. You'll be able to introduce other practitioners to
          MODO and earn money off your own plan.
        </p>
      </div>
    );
  }

  const qualified = (data?.signups ?? []).filter((s) => s.status === "qualified").length;
  const link = data?.code ? `https://modobook.uk/pricing?ref=${data.code}` : "";

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Could not copy — please copy it by hand");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Refer a practitioner</h1>
        <p className="text-sm text-muted-foreground">
          Share your code with another practitioner. They get 25% off their first 3 months, and once
          they start paying you get 50% off one month — one rewarded month for every practitioner you
          bring in.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-border bg-muted/40 px-4 py-2 text-lg font-semibold tracking-widest">
                {data?.code ?? "—"}
              </span>
              {data?.code && (
                <Button variant="outline" size="sm" onClick={() => void copy(data.code!, "Code")}>
                  <Copy className="mr-1 h-4 w-4" /> Copy code
                </Button>
              )}
              {link && (
                <Button variant="outline" size="sm" onClick={() => void copy(link, "Link")}>
                  <Copy className="mr-1 h-4 w-4" /> Copy link
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              They enter this on their Plan &amp; billing page when they join. It only counts once
              they start paying for MODO.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your rewards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              {qualified} paying {qualified === 1 ? "referral" : "referrals"}
            </p>
            <p className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-muted-foreground" />
              {data?.rewardMonthsRemaining ?? 0} half-price {(data?.rewardMonthsRemaining ?? 0) === 1 ? "month" : "months"} banked
            </p>
            <p className="text-xs text-muted-foreground">
              Earned in total: {data?.rewardMonthsEarned ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Practitioners you've introduced</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.signups ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No one has used your code yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data!.signups.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(s.joinedAt).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <Badge variant={s.status === "qualified" ? "default" : "secondary"}>
                    {s.status === "qualified" ? "Reward earned" : "Awaiting first payment"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
