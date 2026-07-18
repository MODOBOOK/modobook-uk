import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getMyInvoices, openStripePortal } from "@/lib/practitioner-billing.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, AlertTriangle, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/invoices")({
  component: InvoicesPage,
});

type Invoice = {
  id: string;
  stripe_invoice_id: string;
  number: string | null;
  status: string;
  currency: string;
  amount_due_cents: number;
  amount_paid_cents: number;
  amount_remaining_cents: number;
  attempt_count: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: string | null;
  period_end: string | null;
  due_date: string | null;
  paid_at: string | null;
  last_payment_error: string | null;
  created_at: string;
};

function fmt(cents: number, currency = "gbp") {
  const symbol = currency === "gbp" ? "£" : currency === "usd" ? "$" : currency === "eur" ? "€" : "";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "paid") return "default";
  if (s === "open" || s === "past_due") return "destructive";
  if (s === "draft" || s === "uncollectible") return "secondary";
  return "outline";
}

function InvoicesPage() {
  const load = useServerFn(getMyInvoices);
  const portal = useServerFn(openStripePortal);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  useEffect(() => {
    load().then((r) => setInvoices((r ?? []) as Invoice[])).catch(() => setInvoices([]));
  }, []);

  const openPortal = async () => {
    try {
      const { url } = await portal({ data: { returnUrl: window.location.href } });
      if (url) window.location.href = url;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not open Stripe portal");
    }
  };

  const outstanding = (invoices ?? []).filter((i) =>
    ["open", "past_due", "uncollectible"].includes(i.status),
  );
  const outstandingTotal = outstanding.reduce((s, i) => s + i.amount_remaining_cents, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6" /> Invoices</h1>
          <p className="text-sm text-muted-foreground">All charges for your MODO subscription.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/dashboard/billing">Plan &amp; billing</Link></Button>
          <Button onClick={openPortal}><ExternalLink className="h-4 w-4 mr-2" />Manage in Stripe</Button>
        </div>
      </div>

      {outstandingTotal > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Outstanding balance: {fmt(outstandingTotal)}
            </CardTitle>
            <CardDescription>
              {outstanding.length} invoice{outstanding.length === 1 ? "" : "s"} pending. Your account is in a 7-day grace period after a failed payment — settle these to avoid your dashboard being locked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {outstanding[0]?.hosted_invoice_url && (
              <Button asChild variant="destructive">
                <a href={outstanding[0].hosted_invoice_url} target="_blank" rel="noreferrer">
                  Pay outstanding invoice
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invoice history</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet. Once you start a subscription, they'll appear here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Invoice</th>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Outstanding</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono text-xs">{inv.number ?? inv.stripe_invoice_id.slice(-8)}</td>
                      <td className="py-2 pr-3">{new Date(inv.created_at).toLocaleDateString()}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
                        {inv.attempt_count > 1 && inv.status !== "paid" && (
                          <span className="ml-2 text-xs text-destructive">{inv.attempt_count} attempts</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">{fmt(inv.amount_due_cents, inv.currency)}</td>
                      <td className="py-2 pr-3">
                        {inv.amount_remaining_cents > 0 ? (
                          <span className="text-destructive font-medium">{fmt(inv.amount_remaining_cents, inv.currency)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex gap-2">
                          {inv.hosted_invoice_url && (
                            <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs inline-flex items-center gap-1">
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {inv.invoice_pdf && (
                            <a href={inv.invoice_pdf} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground text-xs inline-flex items-center gap-1">
                              PDF <Download className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
