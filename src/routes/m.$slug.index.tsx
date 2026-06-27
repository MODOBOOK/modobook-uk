import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { getPublicClinic } from "@/lib/public-clinic.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, ExternalLink, Star } from "lucide-react";
import { mapsUrl, formatAddress } from "@/lib/maps";
import type { Database } from "@/integrations/supabase/types";
type T = Database["public"]["Tables"]["treatments"]["Row"];
type P = Database["public"]["Tables"]["packages"]["Row"];
type L = Database["public"]["Tables"]["locations"]["Row"];

export const Route = createFileRoute("/m/$slug/")({
  loader: async ({ params }) => getPublicClinic({ data: { slug: params.slug } }),
  component: BookPage,
});

function BookPage() {
  const { profile, treatments, packages, locations } = Route.useLoaderData() as ReturnType<typeof Route.useLoaderData> & { locations: L[] };
  const { slug } = useParams({ from: "/m/$slug/" });
  const address = (profile.address as { line1?: string; city?: string; postcode?: string } | null) || {};
  const addressText = [address.line1, address.city, address.postcode].filter(Boolean).join(", ");

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {profile.hero_url && (
        <div className="mb-8 overflow-hidden rounded-2xl">
          <img src={profile.hero_url} alt="" className="h-64 w-full object-cover sm:h-80" />
        </div>
      )}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{profile.clinic_name}</h1>
        {profile.tagline && <p className="mt-2 text-lg text-muted-foreground">{profile.tagline}</p>}
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
          {addressText && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{addressText}</span>}
        </div>
        <div className="mt-4 flex gap-2">
          <Link to="/m/$slug/about" params={{ slug }}><Button variant="outline" size="sm">About {profile.full_name?.split(" ")[0] ?? "practitioner"}</Button></Link>
          <Link to="/m/$slug/reviews" params={{ slug }}><Button variant="outline" size="sm">Read reviews</Button></Link>
        </div>
      </div>

      <h2 className="mb-4 text-xl font-semibold">Book a treatment</h2>
      {treatments.length === 0 ? (
        <p className="text-muted-foreground">No treatments available yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {treatments.map((t: T) => (
            <Card key={t.id}>
              <CardHeader>
                <CardTitle className="text-base">{t.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-4 w-4" />{t.duration ?? 0} min
                  </span>
                  <Badge variant="secondary">£{Number(t.price ?? 0).toFixed(2)}</Badge>
                </div>
                <Link to="/m/$slug/book/$treatmentId" params={{ slug, treatmentId: t.id }} className="block">
                  <Button className="w-full">Book</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {packages.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">Packages</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {packages.map((p: P) => (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{p.session_count} sessions</p>
                  <p className="mt-1 font-semibold">£{Number(p.price ?? 0).toFixed(2)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {locations && locations.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">Locations</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {locations.map((loc: L) => {
              const url = mapsUrl(loc);
              const addr = formatAddress(loc);
              return (
                <Card key={loc.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {loc.name}
                      {loc.is_primary && <Star className="h-4 w-4 fill-current text-yellow-500" />}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {addr && <p className="text-sm text-muted-foreground">{addr}</p>}
                    {loc.phone && <p className="text-sm text-muted-foreground">{loc.phone}</p>}
                    {url && (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="w-full">
                          <MapPin className="mr-2 h-4 w-4" />
                          Open in Maps
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </Button>
                      </a>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
