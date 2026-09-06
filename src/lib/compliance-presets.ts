/**
 * Ready-made checks and audits modelled on the Healthcare Improvement Scotland
 * quality framework (safe, effective, person-centred care). Clinics start from
 * these and can rename, edit or add their own.
 */

export type CheckField =
  | { key: string; label: string; type: "yesno" }
  | { key: string; label: string; type: "number"; unit?: string; min?: number; max?: number }
  | { key: string; label: string; type: "text" };

export type CheckPreset = {
  key: string;
  name: string;
  kind: "fridge" | "cleaning" | "equipment" | "stock" | "custom";
  description: string;
  frequency: Frequency;
  fields: CheckField[];
};

export type Frequency =
  | "daily"
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "quarterly"
  | "biannual"
  | "annual"
  | "adhoc"
  | "custom";

export const FREQUENCIES: { value: Frequency; label: string; days: number }[] = [
  { value: "daily", label: "Every day", days: 1 },
  { value: "weekly", label: "Every week", days: 7 },
  { value: "fortnightly", label: "Every 2 weeks", days: 14 },
  { value: "monthly", label: "Every month", days: 30 },
  { value: "quarterly", label: "Every 3 months", days: 91 },
  { value: "biannual", label: "Every 6 months", days: 182 },
  { value: "annual", label: "Every year", days: 365 },
  { value: "custom", label: "Custom — choose the days", days: 0 },
  { value: "adhoc", label: "No set schedule", days: 0 },

];

export function frequencyDays(f: string | null | undefined) {
  return FREQUENCIES.find((x) => x.value === f)?.days ?? 0;
}

export function frequencyLabel(f: string | null | undefined) {
  return FREQUENCIES.find((x) => x.value === f)?.label ?? "No set schedule";
}

export const CHECK_KIND_LABELS: Record<string, string> = {
  fridge: "Fridge / cold chain",
  cleaning: "Cleaning & environment",
  equipment: "Equipment & safety",
  stock: "Stock & medicines",
  custom: "Other",
};

export const CHECK_PRESETS: CheckPreset[] = [
  {
    key: "fridge-daily",
    name: "Fridge temperature log",
    kind: "fridge",
    description: "Daily cold-chain record for medicines and products stored between 2°C and 8°C.",
    frequency: "daily",
    fields: [
      { key: "current", label: "Current temperature (°C)", type: "number", unit: "°C", min: -5, max: 20 },
      { key: "min", label: "Minimum since last check (°C)", type: "number", unit: "°C", min: -5, max: 20 },
      { key: "max", label: "Maximum since last check (°C)", type: "number", unit: "°C", min: -5, max: 20 },
      { key: "reset", label: "Min/max thermometer reset", type: "yesno" },
      { key: "action", label: "Action taken if out of range", type: "text" },
    ],
  },
  {
    key: "fridge-monthly",
    name: "Fridge deep check",
    kind: "fridge",
    description: "Monthly clean, defrost check, stock rotation and thermometer calibration date.",
    frequency: "monthly",
    fields: [
      { key: "cleaned", label: "Fridge cleaned inside and out", type: "yesno" },
      { key: "ice", label: "Free of ice build-up", type: "yesno" },
      { key: "rotation", label: "Stock rotated, nothing expired", type: "yesno" },
      { key: "calibration", label: "Thermometer calibration in date", type: "yesno" },
      { key: "notes", label: "Notes", type: "text" },
    ],
  },
  {
    key: "cleaning-daily",
    name: "Daily clinical room clean",
    kind: "cleaning",
    description: "Start and end of day clean-down of the treatment room and equipment.",
    frequency: "daily",
    fields: [
      { key: "surfaces", label: "All surfaces and couch wiped with approved disinfectant", type: "yesno" },
      { key: "floor", label: "Floor cleaned", type: "yesno" },
      { key: "waste", label: "Clinical waste bagged and removed", type: "yesno" },
      { key: "sharps", label: "Sharps bin below fill line and dated", type: "yesno" },
      { key: "handwash", label: "Hand wash, soap and towels stocked", type: "yesno" },
      { key: "ppe", label: "PPE stocked (gloves, aprons, masks)", type: "yesno" },
      { key: "notes", label: "Notes", type: "text" },
    ],
  },
  {
    key: "cleaning-weekly",
    name: "Weekly environment check",
    kind: "cleaning",
    description: "Wider premises check — laundry, storage, ventilation and waste contracts.",
    frequency: "weekly",
    fields: [
      { key: "laundry", label: "Laundry / couch roll changed and stocked", type: "yesno" },
      { key: "storage", label: "Storage tidy, clean and clutter-free", type: "yesno" },
      { key: "ventilation", label: "Ventilation working", type: "yesno" },
      { key: "waste_uplift", label: "Clinical waste uplift up to date", type: "yesno" },
      { key: "spill_kit", label: "Spill kit present and in date", type: "yesno" },
      { key: "notes", label: "Notes", type: "text" },
    ],
  },
  {
    key: "equipment-monthly",
    name: "Equipment & emergency kit check",
    kind: "equipment",
    description: "Devices safe and serviced, emergency drugs and kit present and in date.",
    frequency: "monthly",
    fields: [
      { key: "anaphylaxis", label: "Anaphylaxis kit complete and in date", type: "yesno" },
      { key: "adrenaline_expiry", label: "Earliest adrenaline expiry date", type: "text" },
      { key: "hyalase", label: "Hyalase in stock and in date", type: "yesno" },
      { key: "oxygen", label: "Oxygen / airway equipment checked (if held)", type: "yesno" },
      { key: "devices", label: "All devices working, no visible damage", type: "yesno" },
      { key: "pat", label: "Electrical (PAT) testing in date", type: "yesno" },
      { key: "calibration", label: "Calibration / service records in date", type: "yesno" },
      { key: "first_aid", label: "First aid box stocked", type: "yesno" },
      { key: "notes", label: "Notes", type: "text" },
    ],
  },
  {
    key: "stock-monthly",
    name: "Stock & medicines check",
    kind: "stock",
    description: "Expiry dates, batch records and secure storage of prescription-only medicines.",
    frequency: "monthly",
    fields: [
      { key: "expiry", label: "No expired stock on the shelf", type: "yesno" },
      { key: "nearest_expiry", label: "Nearest expiry date", type: "text" },
      { key: "batch", label: "Batch numbers recorded for all products used", type: "yesno" },
      { key: "secure", label: "Medicines stored securely and locked", type: "yesno" },
      { key: "cold_chain", label: "Cold chain products stored correctly", type: "yesno" },
      { key: "disposal", label: "Expired stock disposed of correctly", type: "yesno" },
      { key: "notes", label: "Notes", type: "text" },
    ],
  },
  {
    key: "fire-monthly",
    name: "Fire safety & premises check",
    kind: "equipment",
    description: "Alarms, extinguishers, exits and emergency lighting.",
    frequency: "monthly",
    fields: [
      { key: "alarm", label: "Fire alarm tested", type: "yesno" },
      { key: "extinguisher", label: "Extinguishers in date and unobstructed", type: "yesno" },
      { key: "exits", label: "Fire exits clear", type: "yesno" },
      { key: "lighting", label: "Emergency lighting working", type: "yesno" },
      { key: "notes", label: "Notes", type: "text" },
    ],
  },
];

export type AuditQuestion = { id: string; section: string; text: string };

export type AuditPreset = {
  key: string;
  name: string;
  category: string;
  description: string;
  frequency: Frequency;
  questions: AuditQuestion[];
};

const q = (section: string, items: string[], prefix: string): AuditQuestion[] =>
  items.map((text, i) => ({ id: `${prefix}-${i + 1}`, section, text }));

export const AUDIT_PRESETS: AuditPreset[] = [
  {
    key: "infection-control",
    name: "Infection prevention & control audit",
    category: "Safe care",
    description: "Standard infection control precautions across the clinic.",
    frequency: "quarterly",
    questions: [
      ...q("Hand hygiene", [
        "Hand hygiene facilities are available at the point of care",
        "Staff are bare below the elbow during treatment",
        "Hand hygiene technique posters are displayed",
      ], "hh"),
      ...q("Environment", [
        "The treatment room is visibly clean and clutter-free",
        "Cleaning schedules are completed and signed",
        "Surfaces are non-porous and intact",
      ], "env"),
      ...q("Waste & sharps", [
        "Clinical waste is segregated correctly",
        "Sharps bins are assembled, dated, signed and below the fill line",
        "A waste transfer contract is in place and current",
      ], "waste"),
      ...q("Equipment", [
        "Single-use items are never reused",
        "Reusable equipment is decontaminated per manufacturer guidance",
        "Spill kit available and staff know how to use it",
      ], "eq"),
    ],
  },
  {
    key: "records",
    name: "Patient records audit",
    category: "Effective care",
    description: "Sample of patient records checked for completeness and quality.",
    frequency: "quarterly",
    questions: [
      ...q("Consent", [
        "A signed consent form is present for every treatment",
        "Consent records risks, benefits and alternatives",
        "A cooling-off period is documented where required",
      ], "con"),
      ...q("Assessment", [
        "A medical history is recorded and up to date",
        "Allergies and contraindications are clearly recorded",
        "Photographs are taken and stored securely where relevant",
      ], "as"),
      ...q("Treatment record", [
        "Product, batch number and expiry are recorded",
        "Dose, sites and technique are documented",
        "Aftercare given is documented",
        "Review or follow-up arrangements are recorded",
      ], "tr"),
    ],
  },
  {
    key: "medicines",
    name: "Medicines management audit",
    category: "Safe care",
    description: "Prescribing, storage, cold chain and disposal.",
    frequency: "biannual",
    questions: [
      ...q("Prescribing", [
        "Every POM is prescribed by an appropriate prescriber for a named patient",
        "Prescriptions are retained and traceable",
      ], "pr"),
      ...q("Storage", [
        "Medicines are stored securely and access is controlled",
        "Cold chain is monitored daily with min/max readings",
        "Out-of-range temperatures are escalated and recorded",
      ], "st"),
      ...q("Disposal", [
        "Expired or unused medicines are disposed of correctly",
        "Disposal is documented",
      ], "di"),
    ],
  },
  {
    key: "governance",
    name: "Clinical governance & staffing audit",
    category: "Well led",
    description: "Registration, insurance, training and complaint handling.",
    frequency: "annual",
    questions: [
      ...q("Registration", [
        "Professional registration is current for all clinical staff",
        "Indemnity insurance is current and covers all treatments offered",
        "Premises registration / licensing is in place where required",
      ], "reg"),
      ...q("Training", [
        "Basic life support and anaphylaxis training is in date",
        "Infection control training is in date",
        "Training records are kept for each staff member",
      ], "tra"),
      ...q("Feedback & incidents", [
        "A complaints procedure is published and accessible",
        "Complaints are logged, responded to and learned from",
        "Adverse events are recorded and reviewed",
        "Patient feedback is collected and acted on",
      ], "fb"),
    ],
  },
  {
    key: "person-centred",
    name: "Person-centred care audit",
    category: "Person centred",
    description: "Information, dignity, accessibility and shared decision making.",
    frequency: "annual",
    questions: [
      ...q("Information", [
        "Patients receive clear written information before treatment",
        "Pricing is clear and given in advance",
        "Aftercare instructions are provided in writing",
      ], "inf"),
      ...q("Dignity & access", [
        "Privacy is maintained during consultation and treatment",
        "Chaperone arrangements are available and offered",
        "Reasonable adjustments are made for access needs",
      ], "dg"),
      ...q("Decision making", [
        "Patients are given time to consider treatment",
        "Patients are told how to raise a concern",
      ], "dm"),
    ],
  },
];

export function addDays(dateIso: string, days: number) {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
