import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getPublicClinic } from "@/lib/public-clinic.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Clock, MapPin, ExternalLink, Star, Check } from "lucide-react";
import { mapsUrl, formatAddress } from "@/lib/maps";
import type { Database } from "@/integrations/supabase/types";

type Treatment = Database["public"]["Tables"]["treatments"]["Row"];
type Package = Database["public"]["Tables"]["packages"]["Row"];
type Location = Database["public"]["Tables"]["locations"]["Row"];
type Category = Database["public"]["Tables"]["treatment_categories"]["Row"];
type Pricing = Database["public"]["Tables"]["treatment_location_pricing"]["Row"];

export const Route = createFileRoute("/m/$slug/")({
  loader: async ({ params }) => getPublicClinic({ data: { slug: params.slug } }),
  component: BookPage,
});

type CatNode = Category & { children: CatNode[]; treatments: Treatment[] };

function buildTree(categories: Category[], treatments: Treatment[]): {
  roots: CatNode[];
  uncategorised: Treatment[];
} {
  const map = new Map<string, CatNode>();
  categories.forEach((c) => map.set(c.id, { ...c, children: [], treatments: [] }));
  const roots: CatNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const uncategorised: Treatment[] = [];
  for (const t of treatments) {
    if (t.category_id && map.has(t.category_id)) {
      map.get(t.category_id)!.treatments.push(t);
    } else {
      uncategorised.push(t);
    }
  }
  return { roots, uncategorised };
}

function BookPage() {
  const { profile, treatments, packages, locations, categories, pricing } =
    Route.useLoaderData() as {
      profile: { clinic_name: string; tagline: string | null; hero_url: string | null; full_name: string | null; address: unknown };
      treatments: Treatment[];
      packages: Package[];
      locations: Location[];
      categories: Category[];
      pricing: Pricing[];
    };
  const { slug } = useParams({ from: "/m/$slug/" });

  const [locationId, setLocationId] = useState<string | null>(
    locations.length === 1 ? locations[0].id : null,
  );

  const priceFor = (t: Treatment) => {
    if (locationId) {
      const override = pricing.find(
        (p) => p.treatment_id === t.id && p.location_id === locationId,
      );
      if (override?.price_cents != null) return override.price_cents / 100;
    }
    return Number(t.price ?? 0);
  };
  const durationFor = (t: Treatment) => {
    if (locationId) {
      const override = pricing.find(
        (p) => p.treatment_id === t.id && p.location_id === locationId,
      );
      if (override?.duration_minutes != null) return override.duration_minutes;
    }
    return t.duration ?? 0;
  };
  const isAvailableAtLocation = (t: Treatment) => {
    if (!locationId) return true;
    const rows = pricing.filter((p) => p.treatment_id === t.id);
    if (rows.length === 0) return true; // no overrides = available everywhere
    return rows.some((p) => p.location_id === locationId && p.available);
  };

  const visibleTreatments = useMemo(
    () => treatments.filter(isAvailableAtLocation),
    [treatments, locationId, pricing],
  );
  const { roots, uncategorised } = useMemo(
    () => buildTree(categories, visibleTreatments),
    [categories, visibleTreatments],
  );

  const address = (profile.address as { line1?: string; city?: string; postcode?: string } | null) || {};
  const addressText = [address.line1, address.city, address.postcode].filter(Boolean).join(", ");

  const selectedLocation = locations.find((l) => l.id === locationId) ?? null;

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

      {/* Step 1: Location */}
      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold">
          {locations.length > 1 ? "1. Choose a location" : "Location"}
        </h2>
        {locations.length === 0 ? (
          <p className="text-muted-foreground">No locations have been set up yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {locations.map((loc) => {
              const url = mapsUrl(loc);
              const addr = formatAddress(loc);
              const selected = loc.id === locationId;
              return (
                <Card
                  key={loc.id}
                  className={`cursor-pointer transition ${selected ? "border-primary ring-2 ring-primary" : "hover:border-primary/50"}`}
                  onClick={() => setLocationId(loc.id)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2">
                        {loc.name}
                        {loc.is_primary && <Star className="h-4 w-4 fill-current text-yellow-500" />}
                      </span>
                      {selected && <Check className="h-5 w-5 text-primary" />}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {addr && <p className="text-sm text-muted-foreground">{addr}</p>}
                    {loc.phone && <p className="text-sm text-muted-foreground">{loc.phone}</p>}
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
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
        )}
      </section>

      {/* Step 2: Treatments */}
      {locationId ? (
        <section className="mb-12">
          <h2 className="mb-3 text-xl font-semibold">
            {locations.length > 1 ? "2. Choose a treatment" : "Choose a treatment"}
            {selectedLocation && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                at {selectedLocation.name}
              </span>
            )}
          </h2>
          {visibleTreatments.length === 0 ? (
            <p className="text-muted-foreground">No treatments available at this location.</p>
          ) : (
            <>
              {roots.length > 0 && (
                <CategoryTree nodes={roots} slug={slug} priceFor={priceFor} durationFor={durationFor} />
              )}
              {uncategorised.length > 0 && (
                <div className="mt-6">
                  {roots.length > 0 && <h3 className="mb-3 text-base font-semibold">Other treatments</h3>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {uncategorised.map((t) => (
                      <TreatmentCard key={t.id} t={t} slug={slug} price={priceFor(t)} duration={durationFor(t)} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        locations.length > 1 && (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Pick a location above to see available treatments.
          </p>
        )
      )}

      {packages.length > 0 && locationId && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">Packages</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {packages.map((p) => (
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
    </main>
  );
}

function CategoryTree({
  nodes,
  slug,
  priceFor,
  durationFor,
  depth = 0,
}: {
  nodes: CatNode[];
  slug: string;
  priceFor: (t: Treatment) => number;
  durationFor: (t: Treatment) => number;
  depth?: number;
}) {
  // Hide empty categories (no treatments anywhere in subtree)
  const hasContent = (n: CatNode): boolean =>
    n.treatments.length > 0 || n.children.some(hasContent);
  const visible = nodes.filter(hasContent);
  if (visible.length === 0) return null;

  return (
    <Accordion type="multiple" className={depth === 0 ? "rounded-lg border" : ""}>
      {visible.map((node) => {
        const count =
          node.treatments.length +
          node.children.reduce(
            (sum, c) => sum + countTreatments(c),
            0,
          );
        return (
          <AccordionItem key={node.id} value={node.id} className={depth === 0 ? "border-b last:border-b-0 px-2" : "border-none"}>
            <AccordionTrigger className="hover:no-underline">
              <span className="flex flex-1 items-center justify-between pr-2">
                <span className="text-left font-medium">{node.name}</span>
                <Badge variant="secondary" className="ml-2">{count}</Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-3">
              {node.treatments.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {node.treatments.map((t) => (
                    <TreatmentCard
                      key={t.id}
                      t={t}
                      slug={slug}
                      price={priceFor(t)}
                      duration={durationFor(t)}
                    />
                  ))}
                </div>
              )}
              {node.children.length > 0 && (
                <div className={depth === 0 ? "ml-2 border-l pl-3" : "ml-2 border-l pl-3"}>
                  <CategoryTree
                    nodes={node.children}
                    slug={slug}
                    priceFor={priceFor}
                    durationFor={durationFor}
                    depth={depth + 1}
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

function countTreatments(n: CatNode): number {
  return n.treatments.length + n.children.reduce((s, c) => s + countTreatments(c), 0);
}

function TreatmentCard({
  t,
  slug,
  price,
  duration,
}: {
  t: Treatment;
  slug: string;
  price: number;
  duration: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
        <div className="flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />{duration} min
          </span>
          <Badge variant="secondary">£{price.toFixed(2)}</Badge>
        </div>
        <Link to="/m/$slug/book/$treatmentId" params={{ slug, treatmentId: t.id }} className="block">
          <Button className="w-full">Book</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
