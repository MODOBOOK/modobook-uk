import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { COMING_SOON_FEATURES } from "@/components/ComingSoonDialog";

export const Route = createFileRoute("/_authenticated/dashboard/coming-soon")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Coming soon · MODO" },
      {
        name: "description",
        content: "New MODO features in final testing — upcoming appointments, associate oversight, treatment packages and room rental.",
      },
    ],
  }),
  component: ComingSoonPage,
});

function ComingSoonPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="font-serif text-2xl sm:text-3xl">Coming soon to MODO</h1>
        </div>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          These features are built and in final testing with our pilot clinic. They'll switch on
          automatically for your account once we're happy everything is perfect — you don't need to
          do anything.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {Object.values(COMING_SOON_FEATURES).map((f) => (
          <Card key={f.title} className="border-primary/20">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <f.icon className="h-4 w-4" />
                </span>
                <p className="min-w-0 flex-1 text-sm font-semibold">{f.title}</p>
                <span className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                  Soon
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{f.blurb}</p>
              <ul className="space-y-1.5">
                {f.points.map((p) => (
                  <li key={p} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/40">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Want early access, or have an idea for what we build next? Message the MODO team.
          </p>
          <Button asChild variant="outline" className="rounded-full">
            <a href="https://wa.me/447385790119" target="_blank" rel="noreferrer">
              WhatsApp us
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
