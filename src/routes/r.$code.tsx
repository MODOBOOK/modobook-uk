import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { resolveReferralCode } from "@/lib/rewards.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Gift, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/r/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "You've been invited | MODO" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReferralLandingPage,
});

function ReferralLandingPage() {
  const { code } = useParams({ from: "/r/$code" });
  const navigate = useNavigate();
  const resolve = useServerFn(resolveReferralCode);

  const q = useQuery({
    queryKey: ["resolve-ref", code],
    queryFn: () => resolve({ data: { code } }),
    retry: false,
  });

  useEffect(() => {
    if (!q.data?.slug) return;
    try {
      sessionStorage.setItem("modo_ref_code", code);
      sessionStorage.setItem("modo_ref_slug", q.data.slug);
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => {
      navigate({
        to: "/m/$slug",
        params: { slug: q.data!.slug! },
        search: { ref: code } as any,
      });
    }, 900);
    return () => clearTimeout(t);
  }, [q.data, code, navigate]);

  if (q.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" /> Loading your invite…
        </div>
      </div>
    );
  }

  if (q.error || !q.data?.slug) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md">
          <CardContent className="space-y-3 p-8 text-center">
            <XCircle className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="font-serif text-xl">This invite isn't active</p>
            <p className="text-sm text-muted-foreground">
              The referral code may have expired or the clinic isn't currently running rewards.
            </p>
            <Link to="/">
              <Button variant="outline">Back to MODO</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const friendPennies = q.data.friendCreditPennies;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-md border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="space-y-3 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Gift className="h-7 w-7" />
          </div>
          <p className="font-serif text-2xl">You've been invited</p>
          {friendPennies > 0 && (
            <p className="text-sm">
              Enjoy <strong>£{(friendPennies / 100).toFixed(2)} off</strong> your first booking with{" "}
              <strong>{q.data.clinicName}</strong>.
            </p>
          )}
          <p className="text-xs text-muted-foreground">Taking you to their booking page…</p>
        </CardContent>
      </Card>
    </div>
  );
}
