import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/bookings")({
  ssr: false,
  component: BookingsPage,
});

function BookingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Bookings</h1>
        <p className="text-muted-foreground">Upcoming and past appointments from patients.</p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary"><Users className="h-5 w-5" /></div>
            <div>
              <CardTitle>No bookings yet</CardTitle>
              <CardDescription>Bookings will appear here once patients reserve a slot.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Set up your treatments, availability, and Stripe to start accepting bookings.
        </CardContent>
      </Card>
    </div>
  );
}
