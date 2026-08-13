/**
 * Slug allowlists for features that are being trialled on specific clinics
 * before going live for everyone. Add a slug to roll a feature out, or empty
 * the array (see `isFeatureLive`) to release it to all clinics.
 */

/** "Build your own package" builders — pilot accounts only for now. */
export const PACKAGE_BUILDER_SLUGS = ["aestheticsbynurseryan"];

/** An empty allowlist means "live for everyone". */
export function isFeatureLive(allowlist: string[], slug?: string | null) {
  if (allowlist.length === 0) return true;
  if (!slug) return false;
  return allowlist.includes(slug.toLowerCase());
}

export function packageBuilderEnabled(slug?: string | null) {
  return isFeatureLive(PACKAGE_BUILDER_SLUGS, slug);
}
