// Prepopulated catalogue of popular UK aesthetics medications.
// Prescribers can pick one as a starting point, then edit dose/quantity/directions
// before signing. This is a client-side list — no DB round-trip needed.

export type MedicationPreset = {
  id: string;
  label: string;
  category:
    | "Botulinum toxin"
    | "Dermal filler"
    | "Skin booster"
    | "Fat dissolving"
    | "Polynucleotides"
    | "Adjunct / other";
  drug_name: string;
  drug_form?: string;
  drug_strength?: string;
  dose?: string;
  quantity?: string;
  directions?: string;
  repeats_allowed?: number;
  validity_days?: number;
  notes?: string;
};

export const AESTHETICS_MEDICATIONS: MedicationPreset[] = [
  // ---------- Botulinum toxin type A ----------
  {
    id: "botox-50",
    label: "Botox® 50u (Allergan)",
    category: "Botulinum toxin",
    drug_name: "Botulinum toxin type A (Botox®)",
    drug_form: "Powder for solution for injection",
    drug_strength: "50 units",
    dose: "As per treatment plan (units divided across indicated sites)",
    quantity: "1 vial",
    directions:
      "Reconstitute with 1.25 mL 0.9% sodium chloride. Administer intramuscularly to indicated facial sites by trained practitioner. Single-use.",
    repeats_allowed: 0,
    validity_days: 180,
  },
  {
    id: "botox-100",
    label: "Botox® 100u (Allergan)",
    category: "Botulinum toxin",
    drug_name: "Botulinum toxin type A (Botox®)",
    drug_form: "Powder for solution for injection",
    drug_strength: "100 units",
    dose: "As per treatment plan",
    quantity: "1 vial",
    directions:
      "Reconstitute with 2.5 mL 0.9% sodium chloride. Administer intramuscularly to indicated facial sites by trained practitioner. Single-use.",
    repeats_allowed: 0,
    validity_days: 180,
  },
  {
    id: "azzalure-125",
    label: "Azzalure® 125 Speywood units",
    category: "Botulinum toxin",
    drug_name: "Botulinum toxin type A (Azzalure®)",
    drug_form: "Powder for solution for injection",
    drug_strength: "125 Speywood units",
    dose: "As per treatment plan (Speywood units divided across indicated sites)",
    quantity: "1 vial",
    directions:
      "Reconstitute with 0.63 mL 0.9% sodium chloride. Administer intramuscularly to glabellar / crow's-feet / upper-face sites by trained practitioner. Single-use.",
    repeats_allowed: 0,
    validity_days: 180,
  },
  {
    id: "bocouture-50",
    label: "Bocouture® 50u (Merz)",
    category: "Botulinum toxin",
    drug_name: "Incobotulinumtoxin A (Bocouture®)",
    drug_form: "Powder for solution for injection",
    drug_strength: "50 units",
    dose: "As per treatment plan",
    quantity: "1 vial",
    directions:
      "Reconstitute with 1.25 mL 0.9% sodium chloride. Administer intramuscularly to indicated facial sites by trained practitioner. Single-use.",
    repeats_allowed: 0,
    validity_days: 180,
  },
  {
    id: "bocouture-100",
    label: "Bocouture® 100u (Merz)",
    category: "Botulinum toxin",
    drug_name: "Incobotulinumtoxin A (Bocouture®)",
    drug_form: "Powder for solution for injection",
    drug_strength: "100 units",
    dose: "As per treatment plan",
    quantity: "1 vial",
    directions:
      "Reconstitute with 2.5 mL 0.9% sodium chloride. Administer intramuscularly to indicated facial sites by trained practitioner. Single-use.",
    repeats_allowed: 0,
    validity_days: 180,
  },
  {
    id: "dysport-300",
    label: "Dysport® 300 Speywood units",
    category: "Botulinum toxin",
    drug_name: "Botulinum toxin type A (Dysport®)",
    drug_form: "Powder for solution for injection",
    drug_strength: "300 Speywood units",
    dose: "As per treatment plan",
    quantity: "1 vial",
    directions:
      "Reconstitute per SmPC. Administer intramuscularly by trained practitioner. Single-use.",
    repeats_allowed: 0,
    validity_days: 180,
  },
  {
    id: "letybo-100",
    label: "Letybo® 100u (Croma)",
    category: "Botulinum toxin",
    drug_name: "Letibotulinum toxin A (Letybo®)",
    drug_form: "Powder for solution for injection",
    drug_strength: "100 units",
    dose: "As per treatment plan",
    quantity: "1 vial",
    directions:
      "Reconstitute with 2.5 mL 0.9% sodium chloride. Administer intramuscularly to indicated facial sites by trained practitioner.",
    repeats_allowed: 0,
    validity_days: 180,
  },
  {
    id: "alluzience-125",
    label: "Alluzience® 125u (ready-to-use)",
    category: "Botulinum toxin",
    drug_name: "Botulinum toxin type A (Alluzience®)",
    drug_form: "Solution for injection (ready-to-use)",
    drug_strength: "125 Speywood units / 1.25 mL",
    dose: "As per treatment plan",
    quantity: "1 vial",
    directions:
      "Ready-to-use liquid formulation. Administer intramuscularly by trained practitioner.",
    repeats_allowed: 0,
    validity_days: 180,
  },
  {
    id: "nuceiva-100",
    label: "Nuceiva® 100u (Evolus)",
    category: "Botulinum toxin",
    drug_name: "Prabotulinum toxin A (Nuceiva®)",
    drug_form: "Powder for solution for injection",
    drug_strength: "100 units",
    dose: "As per treatment plan",
    quantity: "1 vial",
    directions:
      "Reconstitute with 2.5 mL 0.9% sodium chloride. Administer intramuscularly by trained practitioner.",
    repeats_allowed: 0,
    validity_days: 180,
  },

  // ---------- Hyaluronic acid dermal fillers ----------
  {
    id: "juvederm-volift",
    label: "Juvéderm® Volift with Lidocaine",
    category: "Dermal filler",
    drug_name: "Cross-linked hyaluronic acid (Juvéderm® Volift Lidocaine)",
    drug_form: "Pre-filled syringe",
    drug_strength: "17.5 mg/mL HA + 0.3% lidocaine · 1 mL",
    dose: "Volume as per treatment plan",
    quantity: "1 syringe (1 mL)",
    directions:
      "Inject into deep dermis / subcutaneous tissue as per treatment plan. Single-use, single-patient.",
    repeats_allowed: 0,
    validity_days: 180,
  },
  {
    id: "juvederm-voluma",
    label: "Juvéderm® Voluma with Lidocaine",
    category: "Dermal filler",
    drug_name: "Cross-linked hyaluronic acid (Juvéderm® Voluma Lidocaine)",
    drug_form: "Pre-filled syringe",
    drug_strength: "20 mg/mL HA + 0.3% lidocaine · 1 mL",
    dose: "Volume as per treatment plan",
    quantity: "1 syringe (1 mL)",
    directions:
      "Inject supraperiosteally / deep subcutaneous for mid-face volumising. Single-use, single-patient.",
    repeats_allowed: 0,
    validity_days: 180,
  },
  {
    id: "juvederm-volbella",
    label: "Juvéderm® Volbella with Lidocaine",
    category: "Dermal filler",
    drug_name: "Cross-linked hyaluronic acid (Juvéderm® Volbella Lidocaine)",
    drug_form: "Pre-filled syringe",
    drug_strength: "15 mg/mL HA + 0.3% lidocaine · 1 mL",
    dose: "Volume as per treatment plan",
    quantity: "1 syringe (1 mL)",
    directions:
      "Inject into mucosal lip / superficial dermis for lip and perioral treatment. Single-use, single-patient.",
    repeats_allowed: 0,
    validity_days: 180,
  },
  {
    id: "restylane-lyft",
    label: "Restylane® Lyft with Lidocaine",
    category: "Dermal filler",
    drug_name: "NASHA hyaluronic acid (Restylane® Lyft Lidocaine)",
    drug_form: "Pre-filled syringe",
    drug_strength: "20 mg/mL HA + 0.3% lidocaine · 1 mL",
    dose: "Volume as per treatment plan",
    quantity: "1 syringe (1 mL)",
    directions:
      "Inject deep dermis / subcutaneous / supraperiosteal for volumising indications.",
    repeats_allowed: 0,
    validity_days: 180,
  },
  {
    id: "restylane-kysse",
    label: "Restylane® Kysse with Lidocaine",
    category: "Dermal filler",
    drug_name: "OBT hyaluronic acid (Restylane® Kysse Lidocaine)",
    drug_form: "Pre-filled syringe",
    drug_strength: "20 mg/mL HA + 0.3% lidocaine · 1 mL",
    dose: "Volume as per treatment plan",
    quantity: "1 syringe (1 mL)",
    directions: "Inject into lip body / vermillion border for lip augmentation.",
    repeats_allowed: 0,
    validity_days: 180,
  },
  {
    id: "teosyal-rha4",
    label: "Teosyal® RHA 4",
    category: "Dermal filler",
    drug_name: "Resilient hyaluronic acid (Teosyal® RHA 4)",
    drug_form: "Pre-filled syringe",
    drug_strength: "23 mg/mL HA + 0.3% lidocaine · 1 mL",
    dose: "Volume as per treatment plan",
    quantity: "1 syringe (1 mL)",
    directions:
      "Inject subcutaneous / supraperiosteal for dynamic facial areas requiring volume.",
    repeats_allowed: 0,
    validity_days: 180,
  },
  {
    id: "belotero-balance",
    label: "Belotero® Balance",
    category: "Dermal filler",
    drug_name: "Cross-linked hyaluronic acid (Belotero® Balance)",
    drug_form: "Pre-filled syringe",
    drug_strength: "22.5 mg/mL HA · 1 mL",
    dose: "Volume as per treatment plan",
    quantity: "1 syringe (1 mL)",
    directions:
      "Inject into mid-dermis for moderate lines and lip refinement.",
    repeats_allowed: 0,
    validity_days: 180,
  },

  // ---------- Skin boosters / bio-remodelling ----------
  {
    id: "profhilo",
    label: "Profhilo® (2 mL)",
    category: "Skin booster",
    drug_name: "Stabilised hybrid hyaluronic acid (Profhilo®)",
    drug_form: "Pre-filled syringe",
    drug_strength: "64 mg/2 mL",
    dose: "2 mL per session; BAP-technique across 5 injection points per side",
    quantity: "1 syringe (2 mL)",
    directions:
      "Inject subcutaneously at 5 BAP points per side. Course: 2 sessions 4 weeks apart, then maintenance.",
    repeats_allowed: 1,
    validity_days: 180,
  },
  {
    id: "profhilo-body",
    label: "Profhilo® Body (3 mL)",
    category: "Skin booster",
    drug_name: "Stabilised hybrid hyaluronic acid (Profhilo® Body)",
    drug_form: "Pre-filled syringe",
    drug_strength: "96 mg/3 mL",
    dose: "3 mL per session",
    quantity: "1 syringe (3 mL)",
    directions:
      "Inject subcutaneously to indicated body sites. Course: 2 sessions 4 weeks apart.",
    repeats_allowed: 1,
    validity_days: 180,
  },
  {
    id: "seventy-hyal-2000",
    label: "Seventy Hyal 2000",
    category: "Skin booster",
    drug_name: "Non-crosslinked hyaluronic acid (Seventy Hyal 2000)",
    drug_form: "Pre-filled syringe",
    drug_strength: "20 mg/mL · 2 mL",
    dose: "As per skin booster plan",
    quantity: "1 syringe (2 mL)",
    directions:
      "Inject intradermally / superficial subcutaneous. Course: 2–3 sessions 2–4 weeks apart.",
    repeats_allowed: 2,
    validity_days: 180,
  },
  {
    id: "sunekos-200",
    label: "Sunekos® 200",
    category: "Skin booster",
    drug_name: "Hyaluronic acid + amino acids (Sunekos® 200)",
    drug_form: "Powder + solvent for injection",
    drug_strength: "1 vial",
    dose: "As per skin booster plan",
    quantity: "1 vial",
    directions:
      "Reconstitute and inject intradermally / superficial subcutaneous. Course: 4 sessions 7 days apart.",
    repeats_allowed: 3,
    validity_days: 180,
  },

  // ---------- Fat dissolving ----------
  {
    id: "aqualyx",
    label: "Aqualyx® (8 mL kit)",
    category: "Fat dissolving",
    drug_name: "Sodium deoxycholate (Aqualyx®)",
    drug_form: "Solution for injection",
    drug_strength: "8 × 8 mL ampoules",
    dose: "As per body-area protocol; typically 2–8 mL per area per session",
    quantity: "As required for session",
    directions:
      "Intralipotherapy — subcutaneous injection to targeted fat pockets by trained practitioner. Minimum 4 weeks between sessions.",
    repeats_allowed: 2,
    validity_days: 180,
  },
  {
    id: "lemon-bottle",
    label: "Lemon Bottle Lipolysis (10 mL)",
    category: "Fat dissolving",
    drug_name: "Lipolytic solution (Lemon Bottle)",
    drug_form: "Solution for injection",
    drug_strength: "10 mL",
    dose: "As per treatment plan",
    quantity: "1 vial (10 mL)",
    directions:
      "Subcutaneous injection to targeted fat pockets by trained practitioner. Minimum 2–4 weeks between sessions.",
    repeats_allowed: 2,
    validity_days: 180,
  },

  // ---------- Polynucleotides ----------
  {
    id: "plinest",
    label: "Plinest® (2 mL)",
    category: "Polynucleotides",
    drug_name: "Polynucleotides HPT™ (Plinest®)",
    drug_form: "Pre-filled syringe",
    drug_strength: "20 mg/2 mL",
    dose: "2 mL per session",
    quantity: "1 syringe (2 mL)",
    directions:
      "Inject intradermally / subcutaneously as per treatment plan. Course: 3 sessions 2–3 weeks apart.",
    repeats_allowed: 2,
    validity_days: 180,
  },
  {
    id: "nucleofill",
    label: "Nucleofill® (1.5 mL)",
    category: "Polynucleotides",
    drug_name: "Polynucleotides (Nucleofill®)",
    drug_form: "Pre-filled syringe",
    drug_strength: "1.5 mL",
    dose: "1.5 mL per session",
    quantity: "1 syringe (1.5 mL)",
    directions:
      "Inject subcutaneously as per treatment plan. Course: 3 sessions 2–3 weeks apart.",
    repeats_allowed: 2,
    validity_days: 180,
  },

  // ---------- Adjuncts ----------
  {
    id: "hyalase-1500",
    label: "Hyalase® 1500 IU (hyaluronidase)",
    category: "Adjunct / other",
    drug_name: "Hyaluronidase (Hyalase®)",
    drug_form: "Powder for solution for injection",
    drug_strength: "1500 IU",
    dose: "As per dissolving protocol; reconstitute per SmPC",
    quantity: "1 vial",
    directions:
      "For dissolution of HA filler or vascular occlusion emergency. Patch-test unless emergency. Administered by trained practitioner only.",
    repeats_allowed: 0,
    validity_days: 30,
    notes:
      "Emergency-use protocol: high-dose flooding for vascular occlusion per JCCP / ACE Group guidance.",
  },
  {
    id: "tranexamic-acid",
    label: "Tranexamic acid 500 mg tablets",
    category: "Adjunct / other",
    drug_name: "Tranexamic acid",
    drug_form: "Tablets",
    drug_strength: "500 mg",
    dose: "500 mg three times daily",
    quantity: "18 tablets (6 days)",
    directions:
      "Take one tablet three times a day with water. Adjunct for bruising management post-treatment.",
    repeats_allowed: 0,
    validity_days: 90,
  },
  {
    id: "aciclovir-400",
    label: "Aciclovir 400 mg (cold-sore prophylaxis)",
    category: "Adjunct / other",
    drug_name: "Aciclovir",
    drug_form: "Tablets",
    drug_strength: "400 mg",
    dose: "400 mg twice daily for 5 days starting 24 hours pre-procedure",
    quantity: "10 tablets",
    directions:
      "HSV prophylaxis for lip / perioral filler in patients with a history of cold sores.",
    repeats_allowed: 0,
    validity_days: 90,
  },
  {
    id: "adrenaline-1-1000",
    label: "Adrenaline 1:1000 (emergency)",
    category: "Adjunct / other",
    drug_name: "Adrenaline (epinephrine)",
    drug_form: "Solution for injection",
    drug_strength: "1 mg/mL (1:1000)",
    dose: "0.5 mg IM (adult) for anaphylaxis, repeat every 5 min PRN",
    quantity: "2 ampoules",
    directions:
      "Emergency use for anaphylaxis per Resuscitation Council UK guidance. Store in clinic emergency kit.",
    repeats_allowed: 0,
    validity_days: 365,
  },
];
