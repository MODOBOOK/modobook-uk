import { useEffect, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyBillingStatus } from "@/lib/practitioner-billing.functions";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Lock } from "lucide-react";

type Status = Awaited<ReturnType<typeof getMyBillingStatus>>;

const BLOCKED_FALLBACK: Status = {
  state: "blocked",
  hasAccess: false,
  daysLeft: 0,
  deadline: null,
  arrearsCents: 0,
  arrearsInvoiceUrl: null,
} as Status;

/** Routes that stay reachable while the account is locked (payment only). */
const ALLOWED_WHEN_LOCKED = ["/dashboard/billing", "/dashboard/invoices"];

export function PlatformBillingGate({ children }: { children: React.ReactNode }) {
  const load = useServerFn(getMyBillingStatus);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: status } = useQuery({
    queryKey: ["platform-billing-status"],
    queryFn: async () => {
      try {
        return (await load()) as Status;
      } catch {
        return BLOCKED_FALLBACK;
      }
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    // While locked, poll so access re-opens automatically right after payment.
    refetchInterval: (q) => ((q.state.data as Status | undefined)?.hasAccess === false ? 10_000 : false),
  });

  const locked = Boolean(status) && !status!.hasAccess;
  const onPaymentPage = ALLOWED_WHEN_LOCKED.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (locked && status!.state !== "suspended" && !onPaymentPage) {
      navigate({ to: "/dashboard/billing", replace: true });
    }
  }, [locked, onPaymentPage, status?.state]);

  if (!status) return <>{children}</>;

  // Hard block — only the payment page is reachable.
  if (locked) {
    if (status.state !== "suspended" && onPaymentPage) {
      return (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <Lock className="h-4 w-4 flex-shrink-0 text-destructive" />
            <div className="flex-1 min-w-0">
              Your account is locked because your trial has ended. Choose a plan below to unlock MODO again.
            </div>
          </div>
          {children}
        </>
      );
    }
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Subscription required</h1>
        <p className="text-muted-foreground mb-6">
          {status.state === "suspended"
            ? "Your MODO account has been suspended. Please contact support."
            : "Your trial and grace period have ended. Choose a plan to continue using MODO."}
        </p>
        {status.state !== "suspended" && (
          <Button asChild size="lg">
            <Link to="/dashboard/billing">Choose a plan</Link>
          </Button>
        )}
      </div>
    );
  }

  const hasArrears = (status.arrearsCents ?? 0) > 0;
  const arrearsAmount = hasArrears ? `£${((status.arrearsCents ?? 0) / 100).toFixed(2)}` : null;

  // Banners for trial / grace / welcome / arrears
  const showBanner =
    !dismissed &&
    (status.state === "trial" || status.state === "grace" || status.state === "welcome" || hasArrears);
  const tone = status.state === "grace" || hasArrears ? "danger" : "info";

  return (
    <>
      {showBanner && (
        <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm ${
          tone === "danger" ? "border-destructive/30 bg-destructive/5" : "border-primary/30 bg-primary/5"
        }`}>
          <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${tone === "danger" ? "text-destructive" : "text-primary"}`} />
          <div className="flex-1 min-w-0">
            {hasArrears ? (
              <>Payment failed — <strong>{arrearsAmount}</strong> outstanding on your MODO subscription.{" "}
                {status.state === "grace" && <>Grace ends in <strong>{status.daysLeft} day{status.daysLeft === 1 ? "" : "s"}</strong>.</>}
              </>
            ) : status.state === "welcome" ? (
              <>Welcome to MODO — you have <strong>{status.daysLeft} days</strong> to explore before choosing a plan.</>
            ) : status.state === "trial" ? (
              <>Your free trial ends in <strong>{status.daysLeft} day{status.daysLeft === 1 ? "" : "s"}</strong>. Add a payment method to keep access.</>
            ) : (
              <>Your subscription needs attention — you have <strong>{status.daysLeft} day{status.daysLeft === 1 ? "" : "s"}</strong> of grace access left before your account is locked.</>
            )}
          </div>
          <Button asChild size="sm" variant={tone === "danger" ? "destructive" : "default"}>
            <Link to={hasArrears ? "/dashboard/invoices" : "/dashboard/billing"}>
              {hasArrears ? "View invoices" : status.state === "grace" ? "Fix billing" : "Manage plan"}
            </Link>
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="text-xs text-muted-foreground hover:text-foreground px-2"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      {children}
    </>
  );
}
