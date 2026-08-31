/**
 * Slug allowlists for features that are being trialled on specific clinics
 * before going live for everyone. Add a slug to roll a feature out, or empty
 * the array (see `isFeatureLive`) to release it to all clinics.
 */

/** "Build your own package" builders — live for everyone. */
export const PACKAGE_BUILDER_SLUGS: string[] = [];

/** An empty allowlist means "live for everyone". */
export function isFeatureLive(allowlist: string[], slug?: string | null) {
  if (allowlist.length === 0) return true;
  if (!slug) return false;
  return allowlist.includes(slug.toLowerCase());
}

export function packageBuilderEnabled(slug?: string | null) {
  return isFeatureLive(PACKAGE_BUILDER_SLUGS, slug);
}

/** "What's new in MODO" dashboard banner — pilot account only for now. */
export const WHATS_NEW_SLUGS: string[] = [];

export function whatsNewEnabled(slug?: string | null) {
  return isFeatureLive(WHATS_NEW_SLUGS, slug);
}

/**
 * Paid Associates module (£4.99/mo + £2.99 per associate beyond 5) — charging
 * is live on the pilot account only; other clinics keep it free for now.
 */
export const ASSOCIATE_BILLING_SLUGS = ["aestheticsbynurseryan"];

export function associateBillingEnabled(slug?: string | null) {
  return isFeatureLive(ASSOCIATE_BILLING_SLUGS, slug);
}



/**
 * Everything shipped in the current pilot round (upcoming appointments page,
 * associate oversight, clinic-owner grouping). Pilot account only until we
 * flip these live for everyone.
 */
export const PILOT_SLUGS = ["aestheticsbynurseryan"];

export function pilotFeaturesEnabled(slug?: string | null) {
  return isFeatureLive(PILOT_SLUGS, slug);
}


/** Treatment packages — live for everyone. */
export const PACKAGES_SLUGS: string[] = [];

export function packagesEnabled(slug?: string | null) {
  return isFeatureLive(PACKAGES_SLUGS, slug);
}


/**
 * Custom link button on the public booking page (e.g. a skincare store) —
 * pilot account only until we're happy with it.
 */
export const LINK_BUTTON_SLUGS = ["aestheticsbynurseryan"];

export function linkButtonEnabled(slug?: string | null) {
  return isFeatureLive(LINK_BUTTON_SLUGS, slug);
}

/**
 * Treatment information leaflets (open/close panel on the booking page) —
 * pilot account only for now.
 */
export const TREATMENT_LEAFLET_SLUGS = ["aestheticsbynurseryan"];

export function treatmentLeafletsEnabled(slug?: string | null) {
  return isFeatureLive(TREATMENT_LEAFLET_SLUGS, slug);
}


/** Upcoming appointments page with AI patient briefs — live for everyone. */
export const UPCOMING_SLUGS: string[] = [];

export function upcomingEnabled(slug?: string | null) {
  return isFeatureLive(UPCOMING_SLUGS, slug);
}

/**
 * SMS / WhatsApp patient notifications. Pilot only — restricted to the two
 * pilot clinics while we finish carrier-filter testing. Everyone else sees
 * "Coming soon" and can never send (even test messages).
 */
export const WHATSAPP_SLUGS: string[] = ["aestheticsbynurseryan", "aesthetiqbyjen", "na-aesthetics"];

export function whatsappMessagingEnabled(slug?: string | null) {
  return isFeatureLive(WHATSAPP_SLUGS, slug);
}

/**
 * Clinics in the SMS pilot but limited to appointment-reminder texts only
 * (no confirmations, cancellations, rebook or review texts) until the full
 * rollout to everyone.
 */
export const WHATSAPP_REMINDER_ONLY_SLUGS: string[] = ["na-aesthetics"];

export function whatsappReminderOnly(slug?: string | null) {
  return isFeatureLive(WHATSAPP_REMINDER_ONLY_SLUGS, slug);
}


/** Course pop-up picker on the public menu (grouped session options). */
export const COURSE_PICKER_SLUGS = ["aestheticsbynurseryan"];

export function coursePickerEnabled(slug?: string | null) {
  return isFeatureLive(COURSE_PICKER_SLUGS, slug);
}
