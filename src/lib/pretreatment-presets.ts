// Preset bullet libraries for pre-treatment information.
// Practitioners can tick/untick these and add their own.

export type PretreatmentCategory =
  | "general"
  | "microneedling"
  | "facials"
  | "laser"
  | "injectables"
  | "chemical_peels"
  | "other";

export const PRETREATMENT_CATEGORIES: { value: PretreatmentCategory; label: string; summary: string }[] = [
  { value: "general", label: "General clinic rules", summary: "Rules that apply to every appointment" },
  { value: "injectables", label: "Injectables (Botox / Filler)", summary: "Anti-wrinkle, dermal filler, polynucleotides" },
  { value: "microneedling", label: "Microneedling / Skin needling", summary: "Microneedling, RF microneedling, mesotherapy" },
  { value: "facials", label: "Facials & skin treatments", summary: "Hydrafacials, deep cleanses, LED, dermaplaning" },
  { value: "laser", label: "Laser & IPL", summary: "Hair removal, pigmentation, laser resurfacing" },
  { value: "chemical_peels", label: "Chemical peels", summary: "Superficial, medium and deep peels" },
  { value: "other", label: "Other / custom", summary: "Anything that doesn't fit the categories above" },
];

export const PRETREATMENT_PRESETS: Record<PretreatmentCategory, string[]> = {
  general: [
    "Arrive 5 minutes early to complete any forms.",
    "Lateness over 15 minutes may require rebooking and forfeit your deposit.",
    "Children and additional guests are not permitted in the treatment room.",
    "Please notify us of any changes to your medical history before your appointment.",
    "Eat a light meal beforehand to reduce light-headedness.",
    "Cash, card and bank transfer are accepted.",
    "A 48-hour cancellation notice is required to avoid charges.",
  ],
  injectables: [
    "Avoid alcohol for 24 hours before your appointment.",
    "Avoid blood-thinning medication (aspirin, ibuprofen, fish oil, vitamin E) for 48 hours unless prescribed.",
    "Do not book if you are pregnant or breastfeeding.",
    "Do not book within 2 weeks of dental work.",
    "Avoid strenuous exercise on the day of treatment.",
    "Inform us if you have had a recent illness, vaccination or cold sore.",
    "Arrive with a clean face — no makeup on the treatment area.",
  ],
  microneedling: [
    "Avoid retinol, AHAs and exfoliants for 5–7 days before treatment.",
    "Avoid sun exposure, sunbeds and self-tan for 2 weeks before.",
    "Do not wax, thread or have laser on the area 7 days before.",
    "Avoid Accutane/Roaccutane use within the last 6 months.",
    "Arrive with a clean face — no makeup, no SPF on the area.",
    "Let us know if you have a history of cold sores so we can advise antivirals.",
    "Stay well hydrated for 24 hours before your appointment.",
  ],
  facials: [
    "Avoid retinol and strong actives for 3 days before your facial.",
    "Do not wax or shave the area 24 hours before.",
    "Arrive with clean skin where possible — makeup will be removed in-clinic.",
    "Let us know about any new skincare, medications or allergies.",
    "Avoid sunbeds and excessive sun exposure for 48 hours before.",
  ],
  laser: [
    "Avoid sun exposure, sunbeds and self-tan for 4 weeks before treatment.",
    "Do not wax, pluck or thread the area for 4 weeks — shaving only.",
    "Shave the treatment area the night before or morning of your appointment.",
    "Avoid retinol and AHAs on the area for 5 days before.",
    "Inform us of any new medications, especially photosensitising drugs.",
    "Arrive with clean skin — no makeup, deodorant, perfume or SPF on the area.",
    "A patch test is required at least 24–48 hours before your first treatment.",
  ],
  chemical_peels: [
    "Stop retinol, AHAs, BHAs and exfoliants 5–7 days before your peel.",
    "Avoid sun exposure and sunbeds for 2 weeks before.",
    "Do not wax, thread or have laser on the area 7 days before.",
    "Avoid Accutane/Roaccutane use within the last 6 months.",
    "Inform us of any history of cold sores, keloid scarring or hyperpigmentation.",
    "Arrive with a clean face — no makeup.",
    "Plan for some downtime: redness and peeling are normal in the days after.",
  ],
  other: [],
};

export function categoryLabel(c: string): string {
  return PRETREATMENT_CATEGORIES.find((x) => x.value === c)?.label ?? "Other";
}
