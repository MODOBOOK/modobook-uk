import { createFileRoute, Link } from "@tanstack/react-router";
import { getPublicClinic } from "@/lib/public-clinic.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Phone, Calendar, Star, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { SafeHtml } from "@/components/SafeHtml";

export const Route = createFileRoute("/book/$slug")({
  loader: async ({ params }) => {
    const { slug } = params;
    const data = await getPublicClinic({ data: { slug } });
    return data;
  },
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold">Clinic page not found</h1>
      <p className="mt-2 text-muted-foreground">This booking link does not exist or has been disabled.</p>
      <Link to="/" className="mt-6">
        <Button>Go home</Button>
      </Link>
    </div>
  ),
  component: ClinicPage,
});

function ClinicPage() {
  const { slug } = Route.useParams();
  const { profile, treatments, packages, testimonials, aboutPage } = Route.useLoaderData() as {
    profile: Database["public"]["Tables"]["profiles"]["Row"];
    treatments: Database["public"]["Tables"]["treatments"]["Row"][];
    packages: Database["public"]["Tables"]["packages"]["Row"][];
    testimonials: Database["public"]["Tables"]["clinic_testimonials"]["Row"][];
    aboutPage?: { intro_heading?: string | null; intro_body?: string | null } | null;
  };

  const brandColor = profile.brand_color || "#111827";
  const address = (profile.address as { line1?: string; city?: string; postcode?: string } | null) || {};
  const addressText = [address.line1, address.city, address.postcode].filter(Boolean).join(", ");
  const introHeading = aboutPage?.intro_heading?.trim() || "";
  const legacyIntroBody = aboutPage?.intro_body?.trim() || "";
  const welcomeHtml = profile.welcome_intro_html?.trim() || (legacyIntroBody ? textToParagraphHtml(legacyIntroBody) : "");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: brandColor }}
            >
              <span className="text-lg font-bold">{profile.clinic_name?.charAt(0) || "C"}</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">{profile.clinic_name}</h1>
              <p className="text-xs text-muted-foreground">{profile.tagline}</p>
            </div>
          </div>
          <a
            href="https://modobook.uk"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="sm">
              Powered by modobook.uk
            </Button>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        {profile.hero_url && (
          <div className="mb-10 overflow-hidden rounded-2xl">
            <img src={profile.hero_url} alt={profile.clinic_name || "Clinic"} className="h-64 w-full object-cover sm:h-80" />
          </div>
        )}




        <div className="mb-10 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-bold tracking-tight">{profile.clinic_name}</h2>
            <p className="mt-3 text-lg text-muted-foreground">{profile.tagline}</p>
            {(introHeading || welcomeHtml) && (
              <div className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
                {introHeading && <h3 className="text-2xl font-semibold tracking-tight">{introHeading}</h3>}
                {welcomeHtml && <SafeHtml html={welcomeHtml} className="prose prose-base mt-3 max-w-none" />}
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted-foreground">
              {addressText && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {addressText}
                </span>
              )}
              {profile.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {profile.phone}
                </span>
              )}
              {profile.email && (
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {profile.email}
                </span>
              )}
            </div>
          </div>
          <div className="rounded-xl border bg-muted/30 p-6">
            <h3 className="font-semibold">Book an appointment</h3>
            <p className="mt-1 text-sm text-muted-foreground">Choose a treatment and select a time.</p>
            <a href={`/m/${profile.slug}`}>
              <Button className="mt-4 w-full" style={{ backgroundColor: brandColor }}>
                <Calendar className="mr-2 h-4 w-4" />
                Book now
              </Button>
            </a>
          </div>
        </div>

        <section className="mb-12">
          <h3 className="mb-4 text-xl font-semibold">Treatments</h3>
          {treatments.length === 0 ? (
            <p className="text-muted-foreground">No treatments available yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {treatments.map((treatment) => (
                <TreatmentCard key={treatment.id} treatment={treatment} brandColor={brandColor} slug={profile.slug ?? ""} />
              ))}
            </div>
          )}
        </section>

        {packages.length > 0 && (
          <section className="mb-12">
            <h3 className="mb-4 text-xl font-semibold">Packages</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <Card key={pkg.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{pkg.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{pkg.session_count} sessions</p>
                    <div className="mt-4 flex items-end justify-between">
                      <span className="text-2xl font-bold">£{(pkg.price / 100).toFixed(2)}</span>
                      <span className="text-sm text-muted-foreground">{pkg.expiry_days ? `Valid for ${pkg.expiry_days} days` : "No expiry"}</span>
                    </div>
                    <Link to="/">
                      <Button className="mt-4 w-full" variant="outline" style={{ borderColor: brandColor, color: brandColor }}>
                        Buy package
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {testimonials.length > 0 && (
          <section className="mb-12">
            <h3 className="mb-4 text-xl font-semibold">Testimonials</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {testimonials.map((t) => (
                <Card key={t.id}>
                  <CardContent className="pt-6">
                    <div className="mb-2 flex gap-0.5">
                      {Array.from({ length: t.rating ?? 5 }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                      ))}
                    </div>
                    <p className="text-sm text-foreground">{t.quote}</p>
                    <p className="mt-3 text-xs font-medium text-muted-foreground">{t.author_name}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <Link to="/" className="hover:underline">
          Create your own booking page with MODO
        </Link>
      </footer>
    </div>
  );
}

function textToParagraphHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function TreatmentCard({
  treatment,
  brandColor,
  slug,
}: {
  treatment: Database["public"]["Tables"]["treatments"]["Row"];
  brandColor: string;
  slug: string;
}) {
  return (
    <Card className="flex flex-col overflow-hidden">
      {treatment.picture_url && (
        <img src={treatment.picture_url} alt={treatment.name} className="h-40 w-full object-cover" />
      )}
      <CardHeader className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{treatment.name}</CardTitle>
          <Badge variant="secondary" className="shrink-0">
            <Clock className="mr-1 h-3 w-3" />
            {treatment.duration}m
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{treatment.description}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xl font-bold">£{(treatment.price / 100).toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">{treatment.payment_mode === "pay_in_clinic" ? "Pay in clinic" : "Book online"}</span>
        </div>
        <Button
          className="w-full"
          style={{ backgroundColor: brandColor }}
          onClick={() => window.location.href = "/"}
        >
          Book
        </Button>
      </CardContent>
    </Card>
  );
}
