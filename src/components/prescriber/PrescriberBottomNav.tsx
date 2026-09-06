import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PrescriberNavTab = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  count?: number;
};

export type PrescriberMoreItem = PrescriberNavTab;

/**
 * The single shared mobile bottom bar for the whole Prescriber Hub
 * (/hub/*, /prescriber/*, /dashboard/rx-requests/*). Every surface uses this
 * so the bar looks and behaves identically no matter which page you're on.
 * Anything beyond the 4 primary tabs lives in the "More" sheet.
 */
export function PrescriberBottomNav({
  tabs,
  moreItems,
  moreFooter,
}: {
  tabs: PrescriberNavTab[]; // up to 4 primary tabs
  moreItems: PrescriberMoreItem[];
  moreFooter?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

  const moreCount = moreItems.reduce((n, i) => n + (i.count ?? 0), 0);
  const moreActive = moreItems.some((i) => (i.exact ? pathname === i.to : pathname.startsWith(i.to)));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-5">
        {tabs.slice(0, 4).map((tab) => {
          const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-12 items-center justify-center rounded-full transition",
                  active && "bg-primary/12",
                )}
              >
                <tab.icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              </span>
              <span className="max-w-full truncate px-1">{tab.label}</span>
              {(tab.count ?? 0) > 0 && (
                <span className="absolute right-3 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {tab.count}
                </span>
              )}
            </Link>
          );
        })}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition",
                moreActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-12 items-center justify-center rounded-full transition",
                  moreActive && "bg-primary/12",
                )}
              >
                <MoreHorizontal className="h-5 w-5" />
              </span>
              <span>More</span>
              {moreCount > 0 && (
                <span className="absolute right-3 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {moreCount}
                </span>
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rx-theme rounded-t-3xl border-t bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <SheetHeader className="pt-1">
              <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted-foreground/25" />
              <SheetTitle className="text-left font-serif text-xl">More</SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {moreItems.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to + item.label}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-2.5 rounded-2xl border p-4 text-[11px] font-semibold transition active:scale-[0.97]",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary",
                    )}
                  >
                    <item.icon className={cn("h-5 w-5", active ? "text-primary-foreground" : "text-accent")} />
                    <span className="text-center leading-tight">{item.label}</span>
                    {(item.count ?? 0) > 0 && (
                      <span
                        className={cn(
                          "absolute right-2 top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                          active ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground",
                        )}
                      >
                        {item.count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            {moreFooter}
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
