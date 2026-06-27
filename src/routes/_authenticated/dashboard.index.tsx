import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scissors, CalendarDays, CreditCard, Link2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardIndex,
});

function DashboardIndex() {
  const { profile } = Route.useRouteContext();
  const bookingUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/m/${profile.slug}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {profile.full_name || profile.clinic_name}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Booking link</CardDescription>
            <CardTitle className="text-sm font-medium">{bookingUrl}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <a href={bookingUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open page
              </a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Upcoming</CardDescription>
            <CardTitle className="text-3xl">0</CardTitle>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard/bookings">
              <Button variant="outline" size="sm" className="w-full">
                <CalendarDays className="mr-2 h-4 w-4" />
                View bookings
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Treatments</CardDescription>
            <CardTitle className="text-3xl">-</CardTitle>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard/treatments">
              <Button variant="outline" size="sm" className="w-full">
                <Scissors className="mr-2 h-4 w-4" />
                Manage treatments
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Stripe</CardDescription>
            <CardTitle className="text-sm font-medium">
              {profile.stripe_connect_account_id ? "Connected" : "Not connected"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard/payments">
              <Button variant="outline" size="sm" className="w-full">
                <CreditCard className="mr-2 h-4 w-4" />
                {profile.stripe_connect_account_id ? "Manage" : "Connect"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quick start</CardTitle>
            <CardDescription>Complete these steps to start taking bookings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChecklistItem done={!!profile.clinic_name} label="Set your clinic name and page" to="/dashboard/clinic" />
            <ChecklistItem done={false} label="Add your first treatment" to="/dashboard/treatments" />
            <ChecklistItem done={false} label="Set weekly availability" to="/dashboard/availability" />
            <ChecklistItem done={!!profile.stripe_connect_account_id} label="Connect Stripe to get paid" to="/dashboard/payments" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Share your link</CardTitle>
            <CardDescription>Copy your booking link and share it with patients.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm">
              <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{bookingUrl}</span>
            </div>
            <Button
              className="mt-4 w-full"
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(bookingUrl);
                import("sonner").then(({ toast }) => toast.success("Link copied"));
              }}
            >
              Copy link
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChecklistItem({
  done,
  label,
  to,
}: {
  done: boolean;
  label: string;
  to: string;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted">
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
          done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
        }`}
      >
        {done ? "✓" : ""}
      </div>
      <span className={done ? "text-muted-foreground line-through" : ""}>{label}</span>
    </Link>
  );
}
