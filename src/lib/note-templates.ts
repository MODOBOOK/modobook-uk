// Prepopulated clinical note templates for UK aesthetics practice.
// Deliberately short, complete prose — no blanks to fill in.
// Inserted as plain text so the practitioner can edit freely.

export type NoteTemplate = {
  id: string;
  label: string;
  category: string;
  /** Where it makes most sense — used to order suggestions, not to restrict. */
  scope?: Array<"note" | "assessment" | "plan" | "aftercare">;
  body: string;
};

const CONSENT = "Risks, benefits and alternatives discussed; written consent taken and questions answered.";

export const NOTE_TEMPLATES: NoteTemplate[] = [
  // ── Consultation & review (most used first) ──────────────────
  {
    id: "consultation",
    label: "New patient consultation",
    category: "Consultation & review",
    scope: ["note", "assessment"],
    body: `Face-to-face consultation. Concerns, goals and expectations discussed and felt to be realistic. Medical history, medications and allergies reviewed with no contraindications identified; not pregnant or breastfeeding. Facial assessment and photographs taken with consent. Treatment options, risks, benefits, alternatives and costs explained with written information provided. ${CONSENT}`,
  },
  {
    id: "review",
    label: "Two week review",
    category: "Consultation & review",
    scope: ["note", "assessment"],
    body: `Review following recent treatment. Patient reports a good result and is satisfied. Any swelling and bruising has settled as expected. On examination the result is symmetrical and settling well with no complications. Comparison photographs taken with consent. No further action needed today and routine maintenance discussed.`,
  },
  {
    id: "complication",
    label: "Complication / adverse event",
    category: "Consultation & review",
    scope: ["note"],
    body: `Patient reviewed following a reported adverse event after treatment. History, onset and symptoms recorded, and the area examined including skin colour, capillary refill, swelling and signs of infection. Working diagnosis and management plan discussed and treatment given in line with clinic protocol. Warning signs, emergency contact details and written information provided, with escalation arranged if symptoms worsen. Follow-up review booked and incident logged with the insurer notified as required.`,
  },
  {
    id: "declined",
    label: "Treatment declined / not suitable",
    category: "Consultation & review",
    scope: ["note"],
    body: `Treatment not carried out today. Following assessment, the patient was not suitable for the requested treatment and the reasons were explained clearly. Alternatives and appropriate advice were offered and written information provided. Patient understood the rationale and agreed the plan; rebooking or onward referral arranged where appropriate.`,
  },

  // ── Injectables ───────────────────────────────────────────────
  {
    id: "toxin-upper-face",
    label: "Botulinum toxin — upper face",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Botulinum toxin type A to the upper face. Product, batch and expiry recorded, reconstituted and stored per manufacturer guidance. Skin cleansed, no active infection and no contraindications reported. Standard intramuscular injection points used with dosing appropriate to muscle bulk. ${CONSENT} Onset over 3–14 days explained. No immediate adverse events; mild erythema expected. Verbal and written aftercare given. Two week review offered.`,
  },
  {
    id: "toxin-lower-face",
    label: "Botulinum toxin — lower face / advanced",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Advanced botulinum toxin treatment to the lower face. Product, batch and expiry recorded. Anatomy assessed and injection points placed to avoid unwanted spread. ${CONSENT} Risks of asymmetry, heaviness and temporary weakness explained, with results lasting approximately three to four months. No immediate adverse events. Verbal and written aftercare given and two week review offered.`,
  },
  {
    id: "hyperhidrosis",
    label: "Botulinum toxin — hyperhidrosis",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Botulinum toxin type A for excessive sweating. Product, batch and expiry recorded. Area cleansed and treated with an intradermal grid at standard spacing. ${CONSENT} Expected duration of four to six months explained. Tolerated well with no adverse events. Aftercare advised to avoid antiperspirant, heat and exercise for 24 hours. Review at four weeks.`,
  },
  {
    id: "filler-lips",
    label: "Dermal filler — lips",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Hyaluronic acid dermal filler to the lips. Product, volume, batch and expiry recorded. Topical anaesthetic applied and skin cleansed. Slow, low-pressure injection used with careful attention to vascular anatomy; hyaluronidase available on site. ${CONSENT} Risks of vascular occlusion, swelling, bruising, lumps and asymmetry specifically discussed. Immediate result symmetrical with normal capillary refill and no blanching or disproportionate pain. Verbal and written aftercare given, including warning signs of occlusion and instruction to contact the clinic immediately. Review in two to four weeks.`,
  },
  {
    id: "filler-midface",
    label: "Dermal filler — cheeks / midface",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Hyaluronic acid dermal filler to the midface. Product, volume, batch and expiry recorded. Skin cleansed and product placed slowly in the appropriate plane with attention to vascular anatomy; hyaluronidase available on site. ${CONSENT} Risk of vascular occlusion and visual compromise discussed. Immediate result symmetrical with no blanching and normal capillary refill. Verbal and written aftercare given. Review in two to four weeks.`,
  },
  {
    id: "filler-jaw-chin",
    label: "Dermal filler — jawline / chin",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Hyaluronic acid dermal filler to the jawline and chin. Product, volume, batch and expiry recorded. Entry points marked and cleansed, product placed slowly with attention to facial artery anatomy and hyaluronidase available on site. ${CONSENT} Immediate result symmetrical with no adverse events. Verbal and written aftercare given. Review in two to four weeks.`,
  },
  {
    id: "dissolving",
    label: "Hyaluronidase — filler dissolving",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Hyaluronidase used to dissolve hyaluronic acid filler. Indication discussed and documented. No history of bee or wasp venom allergy; allergy testing discussed and the patient's decision recorded. Product reconstituted and injected into the treated area. ${CONSENT} Risks of anaphylaxis, loss of native hyaluronic acid and the possible need for repeat sessions explained; anaphylaxis kit available on site. Patient observed after treatment with no adverse reaction. Review in two weeks before considering a further session.`,
  },
  {
    id: "profhilo-boosters",
    label: "Profhilo / skin booster",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Injectable skin booster treatment. Product, batch and expiry recorded. Skin cleansed and product placed at standard points in the appropriate plane. ${CONSENT} Explained that results build over the course and small blebs settle within 24 hours. No adverse events. Verbal and written aftercare given, avoiding make-up for 12 hours and heat or exercise for 24 hours. Next session planned in four weeks.`,
  },
  {
    id: "polynucleotides",
    label: "Polynucleotides",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Polynucleotide treatment. Product, batch and expiry recorded. Fish-derived origin explained and no seafood allergy reported. Skin cleansed and product placed in the appropriate plane. ${CONSENT} Mild swelling expected and no adverse events at the time of treatment. Course of three sessions three to four weeks apart planned.`,
  },
  {
    id: "fat-dissolving",
    label: "Fat dissolving injection",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Fat dissolving injection to the treated area. Product, batch and expiry recorded. Skin cleansed and product placed subcutaneously using a standard grid. ${CONSENT} Significant swelling for three to seven days, tenderness and possible nodules explained. No adverse events. Verbal and written aftercare given and a repeat session planned in around six weeks.`,
  },
  {
    id: "vitamin-injection",
    label: "Vitamin B12 / injectable wellness",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Intramuscular injectable wellness treatment. Product, dose, batch and expiry recorded. Screening completed with no contraindications or known allergies. Skin cleansed, injection given into the deltoid with negative aspiration. ${CONSENT} Tolerated well with no adverse events. Repeat interval discussed.`,
  },

  // ── Skin ─────────────────────────────────────────────────────
  {
    id: "microneedling",
    label: "Microneedling",
    category: "Skin",
    scope: ["note", "plan"],
    body: `Microneedling treatment. Skin cleansed and degreased and topical anaesthetic applied. Device settings selected for the area and passes performed to an endpoint of pin-point erythema. ${CONSENT} Expected erythema afterwards with no adverse events. Aftercare advised: no make-up for 24 hours, daily SPF50, no active skincare for five days and no heat or exercise for 48 hours. Further session planned in four weeks.`,
  },
  {
    id: "peel",
    label: "Chemical peel",
    category: "Skin",
    scope: ["note", "plan"],
    body: `Chemical peel treatment. Skin type assessed and any pre-conditioning confirmed. Skin double cleansed and degreased, peel applied and timed to the expected endpoint, then neutralised and soothed. ${CONSENT} Risk of post-inflammatory hyperpigmentation, the peeling timeline and the need for strict sun protection discussed. No adverse events. Aftercare advised: daily SPF50, no picking, no active skincare for seven days and no heat or exercise for 48 hours. Further session planned as part of the course.`,
  },
  {
    id: "prp",
    label: "PRP / PRF",
    category: "Skin",
    scope: ["note", "plan"],
    body: `Platelet-rich plasma treatment. Venous blood drawn using aseptic technique and processed per the kit instructions. Plasma delivered to the treatment area by injection or microneedling. ${CONSENT} Venepuncture site clean and dressed with no adverse events. Course of three sessions four weeks apart planned.`,
  },
  {
    id: "laser-ipl",
    label: "Laser / IPL",
    category: "Skin",
    scope: ["note", "plan"],
    body: `Laser or IPL treatment. Skin type assessed and a satisfactory patch test confirmed with no adverse reaction. Device settings selected for skin type and indication, with eye protection worn by patient and practitioner throughout. Expected clinical endpoint achieved. ${CONSENT} No blistering or burns and no adverse events. Aftercare advised: daily SPF50, no heat, sun or exercise for 48 hours and no exfoliation for seven days. Further session planned as part of the course.`,
  },

  // ── Admin ────────────────────────────────────────────────────
  {
    id: "dna",
    label: "Did not attend (DNA)",
    category: "Admin",
    scope: ["note"],
    body: `Patient did not attend their booked appointment and did not make contact. Contact attempted by phone and message with no response at the time of writing. Deposit and cancellation policy applied as per clinic terms. Patient invited to rebook.`,
  },
  {
    id: "phone-note",
    label: "Phone / message contact",
    category: "Admin",
    scope: ["note"],
    body: `Contacted by the patient by phone or message. Concerns discussed, reassurance and appropriate advice given, and warning signs explained with instruction to contact the clinic if symptoms change. Review in clinic offered and escalation to a prescriber arranged if needed.`,
  },

  // ── Aftercare ────────────────────────────────────────────────
  {
    id: "aftercare-injectables",
    label: "Aftercare — injectables",
    category: "Aftercare",
    scope: ["aftercare"],
    body: `Keep the area clean and avoid touching or massaging it unless advised. No make-up for 12 hours. Avoid strenuous exercise, saunas, steam rooms and sunbeds for 24–48 hours, and avoid alcohol for 24 hours. After toxin, stay upright for four hours and avoid lying face down. Mild swelling, redness and bruising are normal and settle within a few days; a cool compress can help. Contact the clinic immediately if you have severe or increasing pain, white or dusky discolouration, vision changes or signs of infection.`,
  },
  {
    id: "aftercare-skin",
    label: "Aftercare — skin treatments",
    category: "Aftercare",
    scope: ["aftercare"],
    body: `Cleanse gently with lukewarm water only for the first 24 hours and avoid make-up for 24 hours. Use SPF50 every day for at least two weeks to avoid pigmentation. Pause retinoids, acids, vitamin C and exfoliants for five to seven days. Avoid heat, exercise, saunas and swimming for 48 hours and do not pick or peel flaking skin. Redness, tightness and light flaking are normal — contact the clinic if you notice blistering, spreading redness or signs of infection.`,
  },
];

export const NOTE_TEMPLATE_CATEGORIES = Array.from(
  new Set(NOTE_TEMPLATES.map((t) => t.category)),
);

export function templatesForScope(scope: NonNullable<NoteTemplate["scope"]>[number]) {
  const inScope = NOTE_TEMPLATES.filter((t) => !t.scope || t.scope.includes(scope));
  return inScope.length ? inScope : NOTE_TEMPLATES;
}
