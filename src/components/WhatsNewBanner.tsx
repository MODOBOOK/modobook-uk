import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { whatsNewEnabled } from "@/lib/feature-flags";
import { COMING_SOON_FEATURES } from "@/components/ComingSoonDialog";

/**
 * Bump this whenever the list below changes — dismissals are keyed by version
 * so a new release shows the banner again.
 */
export const WHATS_NEW_VERSION = "2026-08-14-v2";

type Item = { title: string; body: string; to?: string };

const ITEMS: Item[] = [
  {
    title: "Room rental",
    body: "Rent out spare rooms to self-employed practitioners — now live in MODO.",
    to: "/dashboard/room-rental",
  },
  {
    title: "Build your own package",
    body: "Let patients pick their own treatment bundles with automatic pricing.",
    to: "/dashboard/packages",
  },
  {
    title: "Regulated clinic owner?",
    body: "Add your practitioners to MODO so they can book rooms and work under your clinic's regulation.",
    to: "/dashboard/practitioners",
  },
];

export function WhatsNewBanner({ slug }: { slug?: string | null }) {
  const storageKey = `modo:whats-new:${WHATS_NEW_VERSION}`;
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(storageKey) === "1");
    } catch {
      setHidden(false);
    }
  }, [storageKey]);

  if (hidden) return null;
  const live = whatsNewEnabled(slug);
  const items: Item[] = live
    ? ITEMS
    : Object.values(COMING_SOON_FEATURES).map((f) => ({ title: f.title, body: f.blurb }));
  const heading = live ? "What's new in MODO" : "Coming soon to MODO";

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent/20">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-tight">{heading}</p>
            <ul className="mt-3 space-y-2.5">
              {items.map((item) => (
                <li key={item.title} className="text-sm">
                  {item.to ? (
                    <Link to={item.to} className="font-medium underline-offset-4 hover:underline">
                      {item.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{item.title}</span>
                  )}
                  <span className="block text-xs text-muted-foreground">{item.body}</span>
                </li>
              ))}
            </ul>
            {!live && (
              <Link
                to="/dashboard/coming-soon"
                className="mt-3 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                See what's coming
              </Link>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={dismiss}
            aria-label="Dismiss what's new"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
