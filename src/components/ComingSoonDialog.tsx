import { Link } from "@tanstack/react-router";
import { CalendarDays, ShieldCheck, Package, DoorOpen, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ComingSoonKey = "upcoming" | "associates" | "packages" | "room-rental" | "general";

export const COMING_SOON_FEATURES: Record<
  Exclude<ComingSoonKey, "general">,
  { title: string; icon: React.ElementType; blurb: string; points: string[] }
> = {
  upcoming: {
    title: "Upcoming appointments",
    icon: CalendarDays,
    blurb:
      "A dedicated page for everything booked in — far more useful than scrolling the calendar.",
    points: [
      "One list of every upcoming appointment with filters by day, location and practitioner",
      "At-a-glance flags for missing medical or consent forms",
      "AI brief for each patient — allergies, concerns raised and what they've booked",
      "Jump straight into the patient record or reschedule in a tap",
    ],
  },
  associates: {
    title: "Associates (clinic owner)",
    icon: ShieldCheck,
    blurb:
      "For regulated clinics hosting self-employed practitioners who work under your governance.",
    points: [
      "Each associate gets their own page with their full patient list",
      "Clinical records pulled through to you as the responsible clinic",
      "Compliance tracking for DBS, insurance and qualifications with expiry reminders",
      "Supervision meeting logs and incident reporting",
    ],
  },
  packages: {
    title: "Treatment packages & build your own",
    icon: Package,
    blurb:
      "Bundle treatments into packages patients buy upfront — plus a 'build your own' option where they pick their own combination.",
    points: [
      "Build packages from any of your services with custom session counts",
      "Build your own: patients choose treatments themselves for a set price or with an automatic discount",
      "Set expiry windows and sale pricing to drive commitment",
      "Patients see packages on your booking page alongside treatments",
      "Track redemptions and remaining sessions automatically",
    ],
  },
  "room-rental": {
    title: "Room rental",
    icon: DoorOpen,
    blurb:
      "Rent out your treatment rooms by the hour, half day or full day to self-employed practitioners.",
    points: [
      "Set availability and pricing for each room",
      "Online booking with automatic room allocation",
      "Built-in invoices sent straight to renters",
      "See who's in and which room they're using at a glance",
    ],
  },
};

export function ComingSoonDialog({
  open,
  onOpenChange,
  feature = "general",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  feature?: ComingSoonKey;
}) {
  const single = feature !== "general" ? COMING_SOON_FEATURES[feature] : null;
  const list = single ? [single] : Object.values(COMING_SOON_FEATURES);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Coming soon to MODO
          </DialogTitle>
          <DialogDescription>
            We're finishing final testing with our pilot clinic. This will switch on for your
            account shortly — no action needed from you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {list.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <f.icon className="h-4 w-4 text-primary" />
                <p className="min-w-0 flex-1 text-sm font-semibold">{f.title}</p>
                <span className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                  Soon
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{f.blurb}</p>
              <ul className="mt-3 space-y-1.5">
                {f.points.map((p) => (
                  <li key={p} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button asChild onClick={() => onOpenChange(false)}>
            <Link to="/dashboard/coming-soon">See everything coming</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
