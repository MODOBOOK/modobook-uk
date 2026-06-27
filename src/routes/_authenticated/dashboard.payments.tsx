import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { startStripeOnboarding, refreshStripeStatus } from "@/lib/stripe.functions";
import { toast } from "sonner";
import { CreditCard, ExternalLink, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/payments")({
  ssr: false,
  component: PaymentsPage,
});

function PaymentsPage() {
  const { profile } = Route.useRouteContext() as { profile: { stripe_connect_account_id: string | null; stripe_connect_onboarding_status: string | null } };
  const router = useRouter();
  const onboard = useServerFn(startStripeOnboarding);
  const refresh = useServerFn(refreshStripeStatus);
  const [loading, setLoading] = useState(false);

  async function connect() {
    setLoading(true);
    try {
      const origin = window.location.origin;
      const res = await onboard({
        data: {
          returnUrl: `${origin}/dashboard/payments?refresh=1`,
          refreshUrl: `${origin}/dashboard/payments?retry=1`,
        },
      });
      if (res.url) window.location.href = res.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start Stripe onboarding");
    } finally {
      setLoading(false);
    }
  }

  async function checkStatus() {
    setLoading(true);
    try {
      await refresh({});
      toast.success("Status refreshed");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to refresh status");
    } finally {
      setLoading(false);
    }
  }

  const connected = !!profile.stripe_connect_account_id;
  const status = profile.stripe_connect_onboarding_status ?? "not_started";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-muted-foreground">Connect your Stripe account to receive payments from patients.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Stripe Connect</CardTitle>
                <CardDescription>Payments go directly to your Stripe account.</CardDescription>
              </div>
            </div>
            <Badge variant={status === "active" ? "default" : "secondary"}>{status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• 0% platform fee — you keep 100% (minus Stripe processing fees).</li>
            <li>• Klarna & Clearpay supported with a 5% surcharge passed to the patient.</li>
            <li>• Refunds and disputes handled in your own Stripe dashboard.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button onClick={connect} disabled={loading}>
              <ExternalLink className="mr-2 h-4 w-4" />
              {connected ? "Continue Stripe onboarding" : "Connect Stripe"}
            </Button>
            {connected && (
              <Button variant="outline" onClick={checkStatus} disabled={loading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh status
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
