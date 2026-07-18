import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getMyBillingStatus } from "@/lib/practitioner-billing.functions";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Lock } from "lucide-react";

type Status = Awaited<ReturnType<typeof getMyBillingStatus>>;

export function PlatformBillingGate({ children }: { children: React.ReactNode }) {
  const load = useServerFn(getMyBillingStatus);
  const [status, setStatus] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    load()
      .then((s) => alive && setStatus(s as Status))
      .catch(() => alive && setStatus({ state: "blocked", hasAccess: false, daysLeft: 0, deadline: null } as Status));
    return () => { alive = false; };
  }, []);

  if (!status) return <>{children}</>;

  // Hard block
  if (!status.hasAccess) {
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
