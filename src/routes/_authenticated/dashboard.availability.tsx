import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/availability")({
  ssr: false,
  component: AvailabilityPage,
});

function AvailabilityPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Availability</h1>
        <p className="text-muted-foreground">Preset live slots that patients can book.</p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary"><CalendarDays className="h-5 w-5" /></div>
            <div>
              <CardTitle>Coming next</CardTitle>
              <CardDescription>Weekly recurring slots and date blocks.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The availability editor is being set up. In the meantime, your booking page will appear with "Contact to book" until at least one live slot is added.
        </CardContent>
      </Card>
    </div>
  );
}
