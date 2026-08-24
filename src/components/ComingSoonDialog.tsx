import { Link } from "@tanstack/react-router";
import { ShieldCheck, MessageCircle, Mail, Megaphone, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ComingSoonKey = "associates" | "sms-reminders" | "staff-updates" | "sms-marketing" | "general";

export const COMING_SOON_FEATURES: Record<
  Exclude<ComingSoonKey, "general">,
  { title: string; icon: React.ElementType; blurb: string; points: string[] }
> = {
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
  "sms-reminders": {
    title: "SMS reminders",
    icon: MessageCircle,
    blurb:
      "Automatic text reminders sent to patients ahead of their appointment so fewer bookings are missed.",
    points: [
      "Choose how far in advance reminders go out — the day before, a few hours before or your own timing",
      "Patients can reply STOP to opt out of texts at any time",
      "Works alongside your email reminders for patients who prefer a text",
    ],
  },
  "staff-updates": {
    title: "Staff updates",
    icon: Mail,
    blurb:
      "Individual rotas and staff payments — so each team member has their own hours and gets paid the way you agree.",
    points: [
      "Individual rotas per staff member, set separately from the clinic rota",
      "Commission-based pay tracked automatically from the treatments they deliver",
      "Or let staff connect their own Stripe account so payments go straight to them",
    ],
  },

  "sms-marketing": {
    title: "SMS marketing",
    icon: Megaphone,
    blurb:
      "Send promotional text campaigns to opted-in patients to fill quieter slots and drive repeat bookings.",
points: [
      "Targeted SMS campaigns to your opted-in patient list",
      "Free-typed messages you write yourself",
      "Send to fill quieter slots and drive repeat bookings",
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