import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useServerFn } from "@tanstack/react-start";
import {
  startStripeStandardConnect,
  disconnectStripe,
  refreshStripeStatus,
  getStripePayouts,
} from "@/lib/stripe.functions";
import { toast } from "sonner";
import { AlertCircle, CreditCard, ExternalLink, RefreshCw, Wallet, Clock, Unlink } from "lucide-react";

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
  const { profile } = Route.useRouteContext() as {
    profile: {
      stripe_connect_account_id: string | null;
      stripe_connect_onboarding_status: string | null;
      stripe_connect_type?: string | null;
    };
  };
  const router = useRouter();
  const startConnect = useServerFn(startStripeStandardConnect);
  const disconnect = useServerFn(disconnectStripe);
  const refresh = useServerFn(refreshStripeStatus);
  const loadPayouts = useServerFn(getStripePayouts);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<PayoutsData | null>(null);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsError, setPayoutsError] = useState<string | null>(null);

  const connected = !!profile.stripe_connect_account_id;
  const isLegacyExpress = connected && profile.stripe_connect_type !== "standard";
  const status = profile.stripe_connect_onboarding_status ?? "not_started";

  // Surface any error/success message coming back from the OAuth callback.
  useEffect(() => {
    const url = new URL(window.location.href);
    const err = url.searchParams.get("stripe_error");
    const ok = url.searchParams.get("connected");
    if (err) {
      setErrorMsg(err);
      toast.error(err);
      url.searchParams.delete("stripe_error");
      window.history.replaceState({}, "", url.toString());
    } else if (ok) {
      toast.success("Stripe account connected");
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.toString());
      router.invalidate();
    }
  }, [router]);

  async function fetchPayouts() {
    setPayoutsLoading(true);
    setPayoutsError(null);
    try {
      const res = await loadPayouts({});
      if (!res.ok) {
        setPayoutsError(res.message);
        setPayouts(null);
        return;
      }
      setPayouts({
        available: res.available,
        pending: res.pending,
        instantAvailable: res.instantAvailable,
        payouts: res.payouts,
      });
    } catch (e) {
      setPayoutsError(e instanceof Error ? e.message : "Could not load payouts.");
    } finally {
      setPayoutsLoading(false);
    }
  }

  useEffect(() => {
    if (connected && !isLegacyExpress) void fetchPayouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, isLegacyExpress]);

  async function connect() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await startConnect({ data: { origin: window.location.origin } });
      if (!res.ok) {
        setErrorMsg(res.message);
        toast.error(res.message);
        return;
      }
      // Break out of any iframe (e.g. Lovable preview) — Stripe's OAuth
      // page sets X-Frame-Options: DENY and will otherwise appear to hang.
      const target = window.top ?? window;
      try {
        target.location.href = res.url;
      } catch {
        window.open(res.url, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start Stripe connection.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect your Stripe account? You can reconnect anytime.")) return;
    setLoading(true);
    try {
      await disconnect({});
      toast.success("Stripe disconnected");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to disconnect.");
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-muted-foreground">
          Connect your own Stripe account. Payments go directly to you — refunds, payouts and disputes are managed inside your Stripe dashboard and mobile app.
        </p>
      </div>

      {isLegacyExpress && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Old Stripe Express connection detected</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              MODO has moved to full Stripe accounts so you get access via the Stripe website and mobile app. Please reconnect using your own Stripe account.
            </p>
            <Button size="sm" variant="secondary" onClick={handleDisconnect} disabled={loading}>
              Remove old connection
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Stripe account</CardTitle>
                <CardDescription>
                  {connected && !isLegacyExpress
                    ? "Your Stripe account is linked to MODO."
                    : "Connect your Stripe account to start taking payments."}
                </CardDescription>
              </div>
            </div>
            {connected && !isLegacyExpress && (
              <Badge variant={status === "active" ? "default" : "secondary"}>{status}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Stripe connection issue</AlertTitle>
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {!connected || isLegacyExpress ? (
            <>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Payments land directly in your Stripe account.</li>
                <li>• Full Stripe Dashboard access + mobile app.</li>
                <li>• You own refunds, payouts, disputes and bank details.</li>
                <li>• Klarna &amp; Clearpay supported (enable in your own Stripe settings).</li>
              </ul>
              <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                Don't have a Stripe account yet?{" "}
                <a href="https://dashboard.stripe.com/register" target="_blank" rel="noreferrer" className="underline">
                  Create one at stripe.com
                </a>{" "}
                first (takes about 5 minutes), then come back and click Connect.
              </div>
              <Button onClick={connect} disabled={loading}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Connect with Stripe
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="font-mono text-xs text-muted-foreground break-all">
                  {profile.stripe_connect_account_id}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Manage this account at{" "}
                  <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className="underline">
                    dashboard.stripe.com
                  </a>{" "}
                  or in the Stripe mobile app.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={checkStatus} disabled={loading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh status
                </Button>
                <Button variant="ghost" onClick={handleDisconnect} disabled={loading}>
                  <Unlink className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {connected && !isLegacyExpress && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Payouts</CardTitle>
                  <CardDescription>Money on its way from Stripe to your bank account.</CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={fetchPayouts} disabled={payoutsLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${payoutsLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>Payments may take 3–5 working days to clear</AlertTitle>
              <AlertDescription>
                Funds from card, Klarna and Clearpay payments are held by Stripe before being paid out to your bank.
                The pending balance below shows amounts Stripe is still processing.
              </AlertDescription>
            </Alert>

            {payoutsError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{payoutsError}</AlertDescription>
              </Alert>
            )}

            {payouts && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Pending</div>
                    <div className="mt-1 text-lg font-semibold">{sumRow(payouts.pending)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Clearing with Stripe</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Available</div>
                    <div className="mt-1 text-lg font-semibold">{sumRow(payouts.available)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Ready for payout</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Instant available</div>
                    <div className="mt-1 text-lg font-semibold">{sumRow(payouts.instantAvailable)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Eligible for instant payout</div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium">Recent payouts</div>
                  {payouts.payouts.length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No payouts yet. Once Stripe releases your first funds they will appear here.
                    </div>
                  ) : (
                    <div className="divide-y rounded-md border">
                      {payouts.payouts.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                          <div className="min-w-0">
                            <div className="font-medium">{formatMoney(p.amount, p.currency)}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.status === "paid" ? "Arrived" : "Expected"} {new Date(p.arrivalDate * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                              {p.method ? ` · ${p.method}` : ""}
                            </div>
                          </div>
                          <Badge variant={statusBadgeVariant(p.status)}>{p.status.replace("_", " ")}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  Manage bank details and payout schedule in your Stripe dashboard.
                </div>
              </>
            )}

            {!payouts && !payoutsError && payoutsLoading && (
              <div className="text-sm text-muted-foreground">Loading payouts…</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
