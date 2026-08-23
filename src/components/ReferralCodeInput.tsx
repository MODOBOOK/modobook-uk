import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { resolveReferralCode, getPublicRewardsOverview } from "@/lib/rewards.functions";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Gift, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "modo_ref_code";

interface Props {
  clinicSlug: string;
  brand?: string;
}

/**
 * Simple referral-code entry: friend types the code, we validate it belongs
 * to this clinic, then stash it in sessionStorage so the booking submit
 * handler picks it up and links it to the appointment.
 */
export function ReferralCodeInput({ clinicSlug, brand }: Props) {
  const resolve = useServerFn(resolveReferralCode);
  const [value, setValue] = useState("");
  const [applied, setApplied] = useState<{
    code: string;
    friendCreditPennies: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Only show when the clinic has rewards & referrals switched on.
  const fetchOverview = useServerFn(getPublicRewardsOverview);
  const overview = useQuery({
    queryKey: ["public-rewards-visible", clinicSlug],
    queryFn: () => fetchOverview({ data: { slug: clinicSlug } }),
    staleTime: 60_000,
  });

  // Prefill from sessionStorage on mount
  useEffect(() => {
    try {
      const existing = sessionStorage.getItem(STORAGE_KEY);
      if (existing) setValue(existing);
    } catch { /* ignore */ }
  }, []);

  async function apply() {
    const code = value.trim().toUpperCase();
    if (code.length < 3) {
      toast.error("Enter a referral code");
      return;
    }
    setLoading(true);
    try {
      const res = await resolve({ data: { code } });
      if (!res.slug || res.slug !== clinicSlug) {
        toast.error("That referral code isn't valid here");
        try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        setApplied(null);
        return;
      }
      try { sessionStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
      setApplied({ code, friendCreditPennies: res.friendCreditPennies ?? 0 });
      toast.success("Referral code applied");
    } catch {
      toast.error("Couldn't check that code — try again");
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setApplied(null);
    setValue("");
  }

  if (!overview.data || overview.data.visible !== true) return null;

  if (applied) {
    return (
      <Card className="border" style={{ borderColor: brand ?? undefined }}>
        <CardContent className="flex items-center justify-between gap-3 p-3">
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-emerald-600" />
            <div>
              <div className="font-medium">Referral code {applied.code}</div>
              {applied.friendCreditPennies > 0 && (
                <div className="text-xs text-muted-foreground">
                  You'll get £{(applied.friendCreditPennies / 100).toFixed(2)} off your first booking
                </div>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={clear}>
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5 text-xs">
        <Gift className="h-3.5 w-3.5" /> Referral code <span className="text-muted-foreground">(optional)</span>
      </Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="Enter code from a friend"
          maxLength={12}
          className="uppercase tracking-widest"
        />
        <Button type="button" onClick={apply} disabled={loading || !value.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
      <Badge variant="secondary" className="text-[10px] font-normal">
        Have a friend's code? Apply it to unlock their reward.
      </Badge>
    </div>
  );
}
