import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useServerFn } from "@tanstack/react-start";
import { startStripeOnboarding, refreshStripeStatus, getStripePayouts } from "@/lib/stripe.functions";
import { toast } from "sonner";
import { AlertCircle, CreditCard, ExternalLink, RefreshCw, Wallet, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/payments")({
  ssr: false,
  component: PaymentsPage,
});

type PayoutRow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  arrivalDate: number;
  created: number;
  method: string | null;
  description: string | null;
};

type PayoutsData = {
  available: Record<string, number>;
  pending: Record<string, number>;
  instantAvailable: Record<string, number>;
  payouts: PayoutRow[];
};

function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function sumRow(map: Record<string, number>) {
  const entries = Object.entries(map);
  if (entries.length === 0) return "£0.00";
  return entries.map(([c, v]) => formatMoney(v, c)).join(" · ");
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "paid") return "default";
  if (status === "failed" || status === "canceled") return "destructive";
  if (status === "in_transit" || status === "pending") return "secondary";
  return "outline";
}


function PaymentsPage() {
  const { profile } = Route.useRouteContext() as { profile: { stripe_connect_account_id: string | null; stripe_connect_onboarding_status: string | null } };
  const router = useRouter();
  const onboard = useServerFn(startStripeOnboarding);
  const refresh = useServerFn(refreshStripeStatus);
  const [loading, setLoading] = useState(false);
  const [setupIssue, setSetupIssue] = useState<{
    message: string;
    actionUrl?: string;
  } | null>(null);
  const [stripeLink, setStripeLink] = useState<string | null>(null);

  async function connect() {
    const pendingWindow = window.open("about:blank", "_blank");
    setLoading(true);
    try {
      const origin = window.location.origin;
      const res = await onboard({
        data: {
          returnUrl: `${origin}/dashboard/payments?refresh=1`,
          refreshUrl: `${origin}/dashboard/payments?retry=1`,
        },
      });
      if (!res.ok) {
        pendingWindow?.close();
        setSetupIssue({ message: res.message, actionUrl: "actionUrl" in res ? res.actionUrl : undefined });
        toast.error(res.message);
        return;
      }
      setSetupIssue(null);
      if ("recovered" in res && res.recovered) {
        toast.success("Fresh Stripe connection created");
      }
      setStripeLink(res.url);
      if (pendingWindow) {
        pendingWindow.opener = null;
        pendingWindow.location.href = res.url;
      } else {
        toast.info("Your browser blocked the new tab. Use the Stripe button shown below.");
      }
    } catch (e) {
      pendingWindow?.close();
      toast.error(e instanceof Error ? e.message : "Failed to start Stripe onboarding");
    } finally {
      setLoading(false);
    }
  }

  async function checkStatus() {
    setLoading(true);
    try {
      const res = await refresh({});
      if ("reset" in res && res.reset) {
        toast.info("Old Stripe connection cleared. Please connect again.");
      } else {
        toast.success("Status refreshed");
      }
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
          {setupIssue && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Stripe Connect setup needed</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{setupIssue.message}</p>
                {setupIssue.actionUrl && (
                  <Button asChild variant="outline" size="sm">
                    <a href={setupIssue.actionUrl} target="_blank" rel="noreferrer">
                      Open Stripe Connect setup
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
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
            {stripeLink && (
              <Button asChild>
                <a
                  href={stripeLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Stripe manually
                </a>
              </Button>
            )}
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
