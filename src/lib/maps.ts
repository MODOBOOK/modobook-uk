type AddressLike = {
  name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  postcode?: string | null;
  country?: string | null;
};

export function formatAddress(loc: AddressLike): string {
  return [loc.address_line1, loc.address_line2, loc.city, loc.postcode, loc.country]
    .filter(Boolean)
    .join(", ");
}

/** Universal "Open in Maps" URL — works on iOS (Apple Maps), Android and web (Google Maps). */
export function mapsUrl(loc: AddressLike): string | null {
  const q = [loc.name, formatAddress(loc)].filter(Boolean).join(", ");
  if (!q.trim()) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
