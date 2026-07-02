/**
 * Canonical practitioner booking URL.
 *
 * Public share URL: https://{slug}.modobook.uk
 * The wildcard router in src/routes/__root.tsx rewrites that host to /m/{slug}
 * once `*.modobook.uk` DNS is attached in Project Settings → Domains.
 *
 * In non-production hosts (localhost, lovable preview) we fall back to the
 * path-based form so links stay clickable while developing.
 */

const BRANDED_ZONES = ["modobook.uk", "modobook.app", "modobook.co.uk"];
const PRIMARY_ZONE = "modobook.uk";

function currentZone(): string | null {
  if (typeof window === "undefined") return PRIMARY_ZONE;
  const host = window.location.hostname.toLowerCase();
  return BRANDED_ZONES.find((z) => host === z || host.endsWith(`.${z}`)) ?? null;
}

export function buildBookingUrl(slug: string, path = ""): string {
  const zone = currentZone() ?? PRIMARY_ZONE;
  const suffix = path && !path.startsWith("/") ? `/${path}` : path;
  return `https://${slug}.${zone}${suffix}`;
}


/** Short label without the protocol, for display in the UI. */
export function bookingUrlLabel(slug: string): string {
  return buildBookingUrl(slug).replace(/^https?:\/\//, "");
}
