import { treatmentPricing } from "./price-display";

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server").supabaseAdmin
>;

/**
 * Booking prices are never trusted from the browser. The public booking
 * functions recompute every price from the clinic's own settings (treatment
 * price, per-practitioner and per-location overrides, sale windows, model
 * slots, add-ons, promo/gift-card/points codes and membership credit) and
 * reject the booking when the browser's amount doesn't match.
 */

export class PriceMismatchError extends Error {
  constructor() {
    super("The price has changed since you started booking. Please go back and try again.");
    this.name = "PriceMismatchError";
  }
}

/** Tolerance for floating-point rounding between browser and server (£0.011). */
export const PRICE_TOLERANCE = 0.011;

/** Throw unless the browser's price matches the server-computed price. */
export function assertPriceMatches(expected: number, actual: number): number {
  if (!Number.isFinite(actual) || Math.abs(expected - actual) > PRICE_TOLERANCE) {
    throw new PriceMismatchError();
  }
  return expected;
}

/**
 * List price for one treatment, exactly as the public booking pages compute
 * it: per-practitioner override, then (multi-booking only) per-location
 * override, then the treatment price, then any active sale window, then the
 * model-slot price when booking an offer day.
 */
export async function treatmentListPrice(
  admin: AdminClient,
  opts: {
    profileId: string;
    treatmentId: string;
    locationId?: string | null;
    practitionerId?: string | null;
    modelSlotId?: string | null;
    useLocationPricing?: boolean;
  },
): Promise<number> {
  const { data: t } = await admin
    .from("treatments")
    .select(
      "id, price, price_mode, discount_percent, discount_starts_at, discount_ends_at, discount_days_of_week",
    )
    .eq("id", opts.treatmentId)
    .eq("profile_id", opts.profileId)
    .maybeSingle();
  if (!t) throw new PriceMismatchError();

  let base: number | null = null;
  if (opts.practitionerId) {
    const { data: pt } = await admin
      .from("practitioner_treatments")
      .select("price_cents")
      .eq("profile_id", opts.profileId)
      .eq("practitioner_id", opts.practitionerId)
      .eq("treatment_id", opts.treatmentId)
      .maybeSingle();
    if (pt?.price_cents != null) base = Number(pt.price_cents) / 100;
  }
  if (base == null && opts.useLocationPricing && opts.locationId) {
    const { data: lp } = await admin
      .from("treatment_location_pricing")
      .select("price_cents")
      .eq("treatment_id", opts.treatmentId)
      .eq("location_id", opts.locationId)
      .maybeSingle();
    if (lp?.price_cents != null) base = Number(lp.price_cents) / 100;
  }
  if (base == null) base = Number((t as { price?: number | null }).price ?? 0);

  let price = treatmentPricing(t as never, base).price;

  if (opts.modelSlotId) {
    const { data: ms } = await admin
      .from("model_slots")
      .select("price_mode, price_value")
      .eq("id", opts.modelSlotId)
      .eq("profile_id", opts.profileId)
      .eq("treatment_id", opts.treatmentId)
      .eq("active", true)
      .maybeSingle();
    if (ms) {
      const mode = (ms as { price_mode: string }).price_mode;
      const value = Number((ms as { price_value: number }).price_value);
      price = mode === "fixed" ? Math.max(0, value) : Math.max(0, price * (1 - value / 100));
    }
  }
  return price;
}

/**
 * Total (in pence) for the add-ons the patient picked, using the same
 * "biggest saving wins" link logic as the public add-on list. Throws when a
 * picked add-on isn't actually offered with these treatments.
 */
export async function addonTotalCents(
  admin: AdminClient,
  profileId: string,
  treatmentIds: string[],
  addonIds: string[],
): Promise<number> {
  if (!addonIds.length) return 0;

  const { data: treats } = await admin
    .from("treatments")
    .select("id, category_id")
    .in("id", treatmentIds)
    .eq("profile_id", profileId);
  const catIds = Array.from(
    new Set(
      (treats ?? [])
        .map((t) => (t as { category_id: string | null }).category_id)
        .filter((v): v is string => Boolean(v)),
    ),
  );
  // Walk up category ancestors so a link on a parent category applies.
  const allCatIds = new Set<string>(catIds);
  if (catIds.length) {
    const { data: allCats } = await admin
      .from("treatment_categories")
      .select("id, parent_id")
      .eq("profile_id", profileId);
    const byId = new Map<string, string | null>();
    for (const c of (allCats ?? []) as Array<{ id: string; parent_id: string | null }>) {
      byId.set(c.id, c.parent_id ?? null);
    }
    for (const id of catIds) {
      let cur = byId.get(id) ?? null;
      let guard = 0;
      while (cur && guard++ < 20) {
        allCatIds.add(cur);
        cur = byId.get(cur) ?? null;
      }
    }
  }

  const orFilters: string[] = [];
  if (treatmentIds.length) orFilters.push(`treatment_id.in.(${treatmentIds.join(",")})`);
  if (allCatIds.size) orFilters.push(`category_id.in.(${Array.from(allCatIds).join(",")})`);
  if (!orFilters.length) throw new PriceMismatchError();

  const { data: links } = await admin
    .from("addon_links")
    .select(
      "addon_id, discount_percent, discount_amount, addons!inner(id, price_cents, discount_percent, discount_amount, active, profile_id)",
    )
    .or(orFilters.join(","));

  type AddonRow = {
    id: string;
    price_cents: number;
    discount_percent: number | null;
    discount_amount: number | null;
    active: boolean;
    profile_id: string;
  };
  const saving = (priceCents: number, pct: number | null, amt: number | null) => {
    const base = priceCents / 100;
    return Math.max(pct != null ? base * (pct / 100) : 0, amt != null ? Math.min(base, amt) : 0);
  };
  const best = new Map<string, { priceCents: number; pct: number | null; amt: number | null }>();
  for (const l of (links ?? []) as Array<{
    addon_id: string;
    discount_percent: number | null;
    discount_amount: number | null;
    addons: AddonRow | null;
  }>) {
    const a = l.addons;
    if (!a || !a.active || a.profile_id !== profileId) continue;
    const pct =
      l.discount_percent != null
        ? Number(l.discount_percent)
        : a.discount_percent != null
          ? Number(a.discount_percent)
          : null;
    const amt =
      l.discount_amount != null
        ? Number(l.discount_amount)
        : a.discount_amount != null
          ? Number(a.discount_amount)
          : null;
    const cur = best.get(a.id);
    if (!cur || saving(a.price_cents, pct, amt) > saving(cur.priceCents, cur.pct, cur.amt)) {
      best.set(a.id, { priceCents: a.price_cents, pct, amt });
    }
  }

  let total = 0;
  for (const id of addonIds) {
    const b = best.get(id);
    if (!b) throw new PriceMismatchError();
    const base = b.priceCents / 100;
    total += b.amt != null ? Math.max(0, base - b.amt) : base * (1 - (b.pct ?? 0) / 100);
  }
  return Math.round(total * 100);
}

export type VerifiedDiscount = {
  kind: "percent" | "fixed";
  amount: number;
  appliesTo: string[];
} | null;

/**
 * Re-validate a checkout code server-side: clinic promo code, gift card, or
 * the signed-in patient's own loyalty-points code — in the same order the
 * booking page tries them. Returns null when the code is not valid.
 */
export async function verifyDiscountCode(
  admin: AdminClient,
  opts: {
    slug: string;
    code: string;
    treatmentIds: string[];
    packageIds?: string[];
    totalPounds: number;
    patientUserId?: string | null;
  },
): Promise<VerifiedDiscount> {
  const code = opts.code.trim().toUpperCase();
  if (!code) return null;

  // 1) Clinic promo code.
  const { data: rows } = await (admin.rpc as CallableFunction)("validate_discount_code", {
    p_slug: opts.slug.toLowerCase(),
    p_code: code,
    p_treatment_ids: opts.treatmentIds,
  });
  const promo = (Array.isArray(rows) ? rows[0] : null) as {
    kind: "percent" | "fixed";
    amount: number;
    applies_to_treatment_ids: string[];
  } | null;
  if (promo && promo.applies_to_treatment_ids?.length) {
    return {
      kind: promo.kind,
      amount: Number(promo.amount),
      appliesTo: promo.applies_to_treatment_ids,
    };
  }

  const { data: prof } = await admin
    .from("profiles")
    .select("user_id")
    .eq("slug", opts.slug.toLowerCase())
    .maybeSingle();
  const clinicOwnerId = (prof as { user_id?: string } | null)?.user_id;
  if (!clinicOwnerId) return null;

  // 2) Gift card.
  const { data: gc } = await admin
    .from("gift_card_purchases")
    .select("*")
    .eq("profile_id", clinicOwnerId)
    .eq("code", code)
    .maybeSingle();
  if (gc) {
    const card = gc as {
      status: string;
      expires_at: string | null;
      remaining_amount: number;
      kind: string;
      treatment_id: string | null;
      treatment_ids: string[] | null;
      package_id: string | null;
      package_ids: string[] | null;
    };
    const usable =
      card.status === "active" &&
      !(card.expires_at && new Date(card.expires_at).getTime() < Date.now()) &&
      Number(card.remaining_amount) > 0;
    if (usable) {
      const tIds = card.treatment_ids?.length
        ? card.treatment_ids
        : card.treatment_id
          ? [card.treatment_id]
          : [];
      const pIds = card.package_ids?.length ? card.package_ids : card.package_id ? [card.package_id] : [];
      const kindOk =
        card.kind === "value" ||
        (card.kind === "treatment" && tIds.some((id) => opts.treatmentIds.includes(id))) ||
        (card.kind === "package" && pIds.some((id) => (opts.packageIds ?? []).includes(id)));
      if (kindOk) {
        return {
          kind: "fixed",
          amount: Math.min(Number(card.remaining_amount), Math.max(0, opts.totalPounds)),
          appliesTo: opts.treatmentIds,
        };
      }
    }
  }

  // 3) Loyalty points — the signed-in patient's own referral code.
  if (opts.patientUserId) {
    const { data: codeRow } = await admin
      .from("patient_referral_codes")
      .select("patient_user_id, clinic_profile_id")
      .eq("code", code)
      .maybeSingle();
    const row = codeRow as { patient_user_id: string; clinic_profile_id: string } | null;
    if (
      row &&
      row.clinic_profile_id === clinicOwnerId &&
      row.patient_user_id === opts.patientUserId
    ) {
      const { data: settings } = await admin
        .from("clinic_referral_settings")
        .select("enabled, points_redemption_enabled, points_per_pound_redeem")
        .eq("clinic_profile_id", clinicOwnerId)
        .maybeSingle();
      const s = settings as {
        enabled: boolean;
        points_redemption_enabled: boolean;
        points_per_pound_redeem: number;
      } | null;
      const ppp = Number(s?.points_per_pound_redeem ?? 0);
      if (s?.enabled && s.points_redemption_enabled && ppp > 0) {
        const { data: pointsRows } = await admin
          .from("patient_points_ledger")
          .select("delta")
          .eq("patient_user_id", opts.patientUserId)
          .eq("clinic_profile_id", clinicOwnerId);
        const balance = (pointsRows ?? []).reduce(
          (sum, r) => sum + Number((r as { delta: number }).delta ?? 0),
          0,
        );
        const maxPennies = Math.floor(balance / ppp) * 100;
        const pennies = Math.max(0, Math.min(maxPennies, Math.round(opts.totalPounds * 100)));
        if (pennies > 0) {
          return { kind: "fixed", amount: pennies / 100, appliesTo: opts.treatmentIds };
        }
      }
    }
  }

  return null;
}

/**
 * How much of a signed-in patient's membership savings-pot credit can be
 * applied to this booking. Mirrors the public credit preview (balance plus
 * the plan's spend mode), read-only.
 */
export async function creditApplicableCents(
  admin: AdminClient,
  opts: {
    profileId: string;
    patientUserId: string;
    treatmentIds: string[];
    totalCents: number;
  },
): Promise<number> {
  const { data: ledger } = await admin
    .from("patient_credit_ledger")
    .select("delta_pennies")
    .eq("clinic_profile_id", opts.profileId)
    .eq("patient_user_id", opts.patientUserId);
  const balance = (ledger ?? []).reduce(
    (s, r) => s + Number((r as { delta_pennies: number }).delta_pennies),
    0,
  );
  if (balance <= 0) return 0;

  const { data: memberships } = await admin
    .from("patient_memberships")
    .select("membership_plans(spend_mode, eligible_treatment_ids)")
    .eq("profile_id", opts.profileId)
    .eq("patient_user_id", opts.patientUserId)
    .eq("status", "active");

  let mode: "any" | "restricted" | "manual" | null = null;
  for (const m of memberships ?? []) {
    const plan = (
      m as { membership_plans?: { spend_mode: string; eligible_treatment_ids: string[] | null } | null }
    ).membership_plans;
    if (!plan) continue;
    if (plan.spend_mode === "any") {
      mode = "any";
      break;
    }
    if (plan.spend_mode === "restricted") {
      const ids = plan.eligible_treatment_ids ?? [];
      if (opts.treatmentIds.some((t) => ids.includes(t))) mode = "restricted";
    } else if (!mode) {
      mode = "manual";
    }
  }
  if (mode === "manual") return 0;
  return Math.min(balance, Math.max(0, Math.round(opts.totalCents)));
}
