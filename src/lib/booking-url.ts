/**
 * Canonical practitioner booking URL.
 *
 * Uses the path form `https://modobook.uk/{slug}` so every practitioner
 * link works automatically the moment the domain is connected — no per-slug
 * wildcard DNS or per-slug domain entry required.
 *
 * If the app is being viewed on a wildcard subdomain host (e.g.
 * `aestheticsbynurseryan.modobook.uk`) we still honor that, but by default
 * we generate the path form so links are shareable without extra setup.
 */

const BRANDED_ZONES = ["modobook.uk", "modobook.app", "modobook.co.uk"];
const PRIMARY_ZONE = "modobook.uk";

function isBrandedHost(host: string): string | null {
  return BRANDED_ZONES.find((z) => host === z || host.endsWith(`.${z}`)) ?? null;
}

export function buildBookingUrl(slug: string, path = ""): string {
  const suffix = path && !path.startsWith("/") ? `/${path}` : path;
  return `https://${PRIMARY_ZONE}/${slug}${suffix}`;
}

/** Short label without the protocol, for display in the UI. */
export function bookingUrlLabel(slug: string): string {
  return buildBookingUrl(slug).replace(/^https?:\/\//, "");
}

export { isBrandedHost };
