import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  Stethoscope,
  CreditCard,
  MessageCircle,
  ClipboardCheck,
  Users2,
  Link2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Bump this whenever the list changes — dismissals are keyed by version so a
 * new release shows the pop-up again.
 */
export const WHATS_NEW_DIALOG_VERSION = "2026-09-06-rollout";

type Item = { title: string; body: string; to?: string; icon: React.ElementType };

const ITEMS: Item[] = [
  {
    title: "Prescriber Hub",
    body: "A cleaner, faster hub for prescription requests, referrals and clinic days — plus a directory to find a prescriber near you.",
    to: "/hub",
    icon: Stethoscope,
  },
  {
    title: "Memberships",
    body: "Monthly plans with a treatment savings pot, member pricing, included treatments, terms & conditions and patient invites.",
    to: "/dashboard/memberships",
    icon: CreditCard,
  },
  {
    title: "Text notifications",
    body: "Booking confirmations, a 24-hour reminder and review requests can now go out by text as well as email.",
    to: "/dashboard/notifications/sms",
    icon: MessageCircle,
  },
  {
    title: "Clinic compliance",
    body: "Ready-made audits and checks for cleaning, equipment and fire safety, with your own templates and reminder timings.",
    to: "/dashboard/compliance",
    icon: ClipboardCheck,
  },
  {
    title: "Associates",
    body: "Oversight for self-employed practitioners working under your clinic — records, documents, meetings and incidents.",
    to: "/dashboard/associates",
    icon: Users2,
  },
  {
    title: "Add your own link",
    body: "Put a button on your booking page for anything you like — your skincare store, a form or your socials.",
    to: "/dashboard/settings",
    icon: Link2,
  },
];

export function WhatsNewDialog() {
  const storageKey = `modo:whats-new-dialog:${WHATS_NEW_DIALOG_VERSION}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) !== "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const close = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            New in MODO
          </DialogTitle>
          <DialogDescription>
            These are now switched on for your account — nothing for you to set up.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const inner = (
              <div className="flex gap-3 rounded-xl border p-3 transition hover:border-primary/50 hover:bg-muted/40">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              </div>
            );
            return (
              <li key={item.title}>
                {item.to ? (
                  <Link to={item.to} onClick={close} className="block">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>

        <Button className="w-full" onClick={close}>
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}
