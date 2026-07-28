// Prepopulated clinical note templates for UK aesthetics practice.
// Inserted into the editor as plain text so the practitioner can edit freely.

export type NoteTemplate = {
  id: string;
  label: string;
  category: string;
  /** Where it makes most sense — used to order suggestions, not to restrict. */
  scope?: Array<"note" | "assessment" | "plan" | "aftercare">;
  body: string;
};

const CONSENT_LINE = "Risks, benefits and alternatives discussed. Patient consented and had opportunity to ask questions.";

export const NOTE_TEMPLATES: NoteTemplate[] = [
  // ── Injectables ───────────────────────────────────────────────
  {
    id: "toxin-upper-face",
    label: "Botulinum toxin — upper face",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Treatment: Botulinum toxin type A — upper face
Product / batch: [product], batch [ ], expiry [ ]
Areas & dosing: frontalis [ ]u · glabella [ ]u · lateral orbicularis oculi [ ]u — total [ ]u
Dilution: [ ]ml 0.9% sodium chloride
Technique: intramuscular, [ ]G/[ ]mm needle, standard injection points
Pre-treatment: skin cleansed, no active infection, no contraindications reported
${CONSENT_LINE}
Immediate outcome: no adverse events, mild erythema/wheals expected
Aftercare given: verbal + written. Avoid rubbing area, no exercise/heat/alcohol 24h, stay upright 4h.
Review: 2 weeks for top-up assessment. Next treatment due approx [ ] months.`,
  },
  {
    id: "toxin-lower-face",
    label: "Botulinum toxin — lower face / advanced",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Treatment: Botulinum toxin type A — [masseter / DAO / mentalis / platysma / nefertiti / gummy smile]
Product / batch: [product], batch [ ], expiry [ ]
Areas & dosing: [ ] — total [ ]u
Technique: [intramuscular / superficial], [ ]G/[ ]mm needle
Discussion: onset 3–14 days, asymmetry and heaviness risk explained, results last approx 3–4 months.
${CONSENT_LINE}
Immediate outcome: no adverse events
Aftercare given: verbal + written
Review: 2 weeks.`,
  },
  {
    id: "hyperhidrosis",
    label: "Botulinum toxin — hyperhidrosis",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Treatment: Botulinum toxin type A for axillary hyperhidrosis
Product / batch: [product], batch [ ], expiry [ ]
Assessment: [Minor's starch iodine test performed / clinical assessment only]
Dosing: right axilla [ ]u · left axilla [ ]u — total [ ]u, intradermal grid ~1–2cm spacing
${CONSENT_LINE}
Aftercare: avoid antiperspirant 24h, no heat/exercise 24h.
Review: 4 weeks. Expected duration 4–6 months.`,
  },
  {
    id: "filler-lips",
    label: "Dermal filler — lips",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Treatment: HA dermal filler — lips
Product / batch: [product], [ ]ml used, batch [ ], expiry [ ]
Goal: [hydration / definition / volume / asymmetry correction]
Technique: [needle / cannula], [ ]G, [linear threading / bolus / tenting], submucosal
Anaesthetic: topical [ ] / product contains lidocaine
Vascular safety: aspiration performed where appropriate, slow low-pressure injection, hyaluronidase available on site.
${CONSENT_LINE} Risk of vascular occlusion, swelling, bruising, lumps and asymmetry specifically discussed.
Immediate outcome: symmetrical result, capillary refill normal, no blanching or pain out of proportion.
Aftercare given: verbal + written. Warning signs of occlusion explained; patient knows to contact clinic immediately.
Review: 2–4 weeks.`,
  },
  {
    id: "filler-midface",
    label: "Dermal filler — cheeks / midface",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Treatment: HA dermal filler — [cheeks / tear trough / temples / nasolabial]
Product / batch: [product], [ ]ml total ([ ]ml right, [ ]ml left), batch [ ], expiry [ ]
Technique: [cannula [ ]G via lateral entry point / needle], depth [supraperiosteal / deep fat compartment]
Vascular safety: aspiration where appropriate, retrograde slow injection, hyaluronidase on site.
${CONSENT_LINE} Vascular occlusion and visual compromise risk discussed.
Immediate outcome: no blanching, normal capillary refill, symmetrical
Aftercare given: verbal + written
Review: 2–4 weeks.`,
  },
  {
    id: "filler-jaw-chin",
    label: "Dermal filler — jawline / chin",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Treatment: HA dermal filler — [jawline / chin]
Product / batch: [product], [ ]ml total, batch [ ], expiry [ ]
Technique: [needle bolus supraperiosteal / cannula subcutaneous], entry points marked and cleansed
Vascular safety: facial artery anatomy considered, aspiration where appropriate, slow injection.
${CONSENT_LINE}
Immediate outcome: symmetrical, no adverse events
Aftercare given: verbal + written
Review: 2–4 weeks.`,
  },
  {
    id: "dissolving",
    label: "Hyaluronidase — filler dissolving",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Treatment: Hyaluronidase — dissolving of HA filler
Indication: [overfilled / migration / nodule / patient request / vascular concern]
Allergy check: no history of bee/wasp venom allergy. Patch test [performed / declined by patient — documented] at [ ].
Product: hyaluronidase [ ]iu reconstituted in [ ]ml 0.9% sodium chloride
Areas & volume injected: [ ]
${CONSENT_LINE} Risk of anaphylaxis, loss of native HA, and need for repeat sessions discussed. Anaphylaxis kit available on site.
Immediate outcome: no adverse reaction, patient observed [ ] minutes post-treatment
Review: 2 weeks before considering repeat session.`,
  },
  {
    id: "profhilo-boosters",
    label: "Profhilo / skin booster",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Treatment: [Profhilo / Seventy Hyal / Sunekos / other skin booster]
Product / batch: [product] [ ]ml, batch [ ], expiry [ ]
Technique: [BAP 5-point per side / micro-bolus / mesotherapy], [ ]G needle
${CONSENT_LINE} Explained results build over the course, small blebs settle in 24h.
Immediate outcome: expected blebs present, no adverse events
Aftercare given: verbal + written. No make-up 12h, no heat/exercise 24h.
Plan: session [ ] of [ ]. Next session in 4 weeks.`,
  },
  {
    id: "polynucleotides",
    label: "Polynucleotides",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Treatment: Polynucleotides — [under eye / face / neck / scalp]
Product / batch: [product] [ ]ml, batch [ ], expiry [ ]
Technique: [needle micro-bolus / cannula], depth [intradermal / subdermal]
${CONSENT_LINE} Fish-derived origin and allergy status discussed — no seafood allergy reported.
Immediate outcome: no adverse events, mild swelling expected
Plan: session [ ] of 3, 3–4 weeks apart.`,
  },
  {
    id: "fat-dissolving",
    label: "Fat dissolving injection",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Treatment: Deoxycholic acid fat dissolving — [submental / jowls / body area]
Product / batch: [product], [ ]ml, batch [ ], expiry [ ]
Technique: subcutaneous grid, [ ]cm spacing, [ ]ml per point
${CONSENT_LINE} Significant swelling for 3–7 days, tenderness and possible nodules discussed.
Immediate outcome: no adverse events
Aftercare given: verbal + written
Plan: session [ ] of [ ], repeat in 6 weeks.`,
  },
  {
    id: "vitamin-injection",
    label: "Vitamin B12 / injectable wellness",
    category: "Injectables",
    scope: ["note", "plan"],
    body: `Treatment: [Vitamin B12 hydroxocobalamin / other]
Dose / batch: [ ]mg, batch [ ], expiry [ ]
Route/site: intramuscular, [left/right] deltoid, [ ]G needle, aspiration negative
Screening: no contraindications, no known allergy, [pregnancy status confirmed]
${CONSENT_LINE}
Immediate outcome: tolerated well, no adverse events
Plan: repeat every [ ] weeks.`,
  },

  // ── Skin ─────────────────────────────────────────────────────
  {
    id: "microneedling",
    label: "Microneedling",
    category: "Skin",
    scope: ["note", "plan"],
    body: `Treatment: Microneedling — [device], [ ]mm depth
Areas: [full face / neck / décolletage / scarring]
Prep: skin cleansed and degreased, topical anaesthetic [ ] applied for [ ] minutes
Serum used: [ ] (batch [ ])
Passes: [ ] in [ ] directions, endpoint pin-point erythema
${CONSENT_LINE}
Immediate outcome: expected erythema, no pinpoint bleeding beyond normal, no adverse events
Aftercare: no make-up 24h, SPF50 daily, no active ingredients 5 days, no heat/exercise 48h.
Plan: session [ ] of [ ], 4 weeks apart.`,
  },
  {
    id: "peel",
    label: "Chemical peel",
    category: "Skin",
    scope: ["note", "plan"],
    body: `Treatment: Chemical peel — [product / acid and %]
Indication: [acne / pigmentation / texture / dullness]
Fitzpatrick type: [ ] · Pre-conditioning: [ ] weeks of [ ]
Prep: double cleanse, degrease with [ ]
Layers / dwell time: [ ] layers, [ ] minutes, neutralised with [ ]
Endpoint: [level 1 erythema / frosting level [ ]]
${CONSENT_LINE} PIH risk, peeling timeline and strict SPF discussed.
Aftercare: SPF50, no picking, no actives 7 days, no heat/exercise 48h.
Plan: session [ ] of [ ], [ ] weeks apart.`,
  },
  {
    id: "prp",
    label: "PRP / PRF",
    category: "Skin",
    scope: ["note", "plan"],
    body: `Treatment: [PRP / PRF] — [face / under eye / scalp]
Draw: [ ]ml venous blood, [left/right] antecubital fossa, aseptic technique
Processing: [kit], spun [ ] rpm for [ ] mins, [ ]ml plasma obtained
Delivery: [injection / microneedling], depth [ ]
${CONSENT_LINE}
Immediate outcome: no adverse events, venepuncture site clean and dressed
Plan: session [ ] of 3, 4 weeks apart.`,
  },
  {
    id: "laser-ipl",
    label: "Laser / IPL",
    category: "Skin",
    scope: ["note", "plan"],
    body: `Treatment: [device] — [hair removal / vascular / pigment / resurfacing]
Areas: [ ] · Fitzpatrick type: [ ]
Patch test: performed [date], no adverse reaction
Settings: fluence [ ] J/cm² · pulse width [ ]ms · spot size [ ]mm · cooling [ ]
Endpoint: [perifollicular oedema / vessel clearance / mild erythema]
Eye protection worn by patient and practitioner.
${CONSENT_LINE}
Immediate outcome: no blistering or burns, no adverse events
Aftercare: SPF50, no heat/sun/exercise 48h, no exfoliation 7 days.
Plan: session [ ] of [ ], [ ] weeks apart.`,
  },

  // ── Consultation & review ────────────────────────────────────
  {
    id: "consultation",
    label: "New patient consultation",
    category: "Consultation",
    scope: ["note", "assessment"],
    body: `Consultation type: new patient, face-to-face
Presenting concerns: [in patient's own words]
Expectations & motivation: [ ] — realistic / requires managing
Medical history: reviewed, form completed [date]. Significant: [none / [ ]]
Medications & allergies: [none known / [ ]]
Previous aesthetic treatments: [product, area, date, practitioner]
Pregnancy / breastfeeding: [n/a / confirmed not]
Examination: skin type Fitzpatrick [ ], [asymmetry / volume loss / dynamic lines / laxity] noted
Photographs: taken with consent [yes/no]
Discussion: options, risks, benefits, alternatives and costs discussed. Written information provided.
Outcome: [proceeding today / cooling-off period, review booked / not suitable — reason [ ]]`,
  },
  {
    id: "review",
    label: "2 week review / follow-up",
    category: "Consultation",
    scope: ["note", "assessment"],
    body: `Review following [treatment] on [date].
Patient reports: [satisfied / concerns: [ ]]
Downtime experienced: [bruising / swelling / none] — resolved [yes/no]
Examination: [symmetrical, settled well / residual [ ]]
Action: [no further action / top-up [ ]u given / massage advised / plan adjusted]
Photographs: comparison taken with consent [yes/no]
Next appointment: [ ]`,
  },
  {
    id: "complication",
    label: "Complication / adverse event",
    category: "Consultation",
    scope: ["note"],
    body: `Adverse event review.
Treatment involved: [product, area, volume/units] performed on [date]
Onset: [ ] · Symptoms reported: [ ]
Examination findings: [blanching / dusky discolouration / capillary refill [ ]s / swelling / nodule / infection signs / ptosis]
Working diagnosis: [ ]
Management: [hyaluronidase [ ]iu given / antibiotics advised / warm compress + massage / aspirin per protocol / observation]
Escalation: [none required / GP / A&E / medical director / prescriber contacted at [time]]
Patient advised: warning signs, emergency contact details given, written information provided.
Follow-up: reviewed [date/time], contact within 24 hours arranged.
Incident logged and insurer notified: [yes/no]`,
  },
  {
    id: "declined",
    label: "Treatment declined / not suitable",
    category: "Consultation",
    scope: ["note"],
    body: `Treatment not carried out today.
Reason: [medical contraindication / unrealistic expectations / active infection / recent treatment elsewhere / patient decision / BDD screening concern]
Discussion: rationale explained, alternatives offered [ ].
Advice given: [ ]
Outcome: [rebooked for [ ] / referred to GP / no further action]`,
  },
  {
    id: "dna",
    label: "Did not attend (DNA)",
    category: "Admin",
    scope: ["note"],
    body: `Patient did not attend appointment on [date] at [time].
Contact attempted: [call / text / email] at [time]. Response: [none / [ ]]
Deposit / fee: [retained per policy / waived]
Outcome: [rebooked [ ] / removed from list / policy reminder sent]`,
  },
  {
    id: "phone-note",
    label: "Phone / message contact",
    category: "Admin",
    scope: ["note"],
    body: `Contact by [phone / text / email] on [date] at [time].
Patient reports: [ ]
Advice given: [ ]
Action: [reassurance / reviewed in clinic [date] / escalated to prescriber]
Duration of call: [ ] minutes.`,
  },

  // ── Aftercare ────────────────────────────────────────────────
  {
    id: "aftercare-injectables",
    label: "Aftercare — injectables",
    category: "Aftercare",
    scope: ["aftercare"],
    body: `Keep the area clean and avoid touching or massaging unless advised.
No make-up for 12 hours.
Avoid strenuous exercise, saunas, steam rooms and sunbeds for 24–48 hours.
Avoid alcohol for 24 hours.
Stay upright for 4 hours after toxin and avoid lying face down.
Mild swelling, redness and bruising are normal and settle within a few days.
Arnica or a cool compress can help with bruising.
Contact the clinic immediately if you experience severe or increasing pain, blanching (white patches), dusky/blue discolouration, vision changes or signs of infection.`,
  },
  {
    id: "aftercare-skin",
    label: "Aftercare — skin treatments",
    category: "Aftercare",
    scope: ["aftercare"],
    body: `Cleanse gently with lukewarm water only for the first 24 hours.
No make-up for 24 hours.
Use SPF50 daily for at least two weeks — this is essential to avoid pigmentation.
Pause retinoids, acids, vitamin C and exfoliants for 5–7 days.
Avoid heat, exercise, saunas and swimming for 48 hours.
Do not pick or peel flaking skin.
Redness, tightness and light flaking are normal. Contact the clinic if you notice blistering, spreading redness or signs of infection.`,
  },
];

export const NOTE_TEMPLATE_CATEGORIES = Array.from(
  new Set(NOTE_TEMPLATES.map((t) => t.category)),
);

export function templatesForScope(scope: NonNullable<NoteTemplate["scope"]>[number]) {
  const inScope = NOTE_TEMPLATES.filter((t) => !t.scope || t.scope.includes(scope));
  return inScope.length ? inScope : NOTE_TEMPLATES;
}
