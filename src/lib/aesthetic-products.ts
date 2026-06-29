// Popular UK aesthetics products grouped by treatment type.
// Practitioners can also add their own (stored per-browser in localStorage).

export type ProductCategory = {
  key: string;
  label: string;
  products: string[];
};

export const AESTHETIC_PRODUCTS: ProductCategory[] = [
  {
    key: "anti-wrinkle",
    label: "Anti-wrinkle (Botulinum Toxin)",
    products: [
      "Allergan Botox",
      "Galderma Azzalure",
      "Merz Bocouture",
      "Croma Letybo",
      "Galderma Alluzience",
      "Evolus Nuceiva",
      "Ipsen Dysport",
      "Daxxify",
    ],
  },
  {
    key: "dermal-fillers",
    label: "Dermal Fillers (HA)",
    products: [
      "Juvéderm Volbella",
      "Juvéderm Volift",
      "Juvéderm Voluma",
      "Juvéderm Volux",
      "Juvéderm Vollure",
      "Juvéderm Ultra 2",
      "Juvéderm Ultra 3",
      "Juvéderm Ultra 4",
      "Juvéderm Volite",
      "Restylane Kysse",
      "Restylane Lyft",
      "Restylane Defyne",
      "Restylane Refyne",
      "Restylane Volyme",
      "Restylane Eyelight",
      "Restylane Skinboosters Vital",
      "Teosyal Kiss",
      "Teosyal Deep Lines",
      "Teosyal Ultra Deep",
      "Teosyal Ultimate",
      "Teosyal Redensity I",
      "Teosyal Redensity II",
      "Teosyal RHA 1",
      "Teosyal RHA 2",
      "Teosyal RHA 3",
      "Teosyal RHA 4",
      "Belotero Soft",
      "Belotero Balance",
      "Belotero Intense",
      "Belotero Volume",
      "Belotero Revive",
      "Stylage S",
      "Stylage M",
      "Stylage L",
      "Stylage XL",
      "Stylage Lips",
      "Stylage Hydro",
      "Saypha Filler",
      "Saypha Volume",
      "Saypha Rich",
      "Princess Filler",
      "Princess Volume",
      "Neauvia Intense",
      "Neauvia Stimulate",
    ],
  },
  {
    key: "bio-stimulators",
    label: "Bio-stimulators / Collagen",
    products: [
      "Sculptra (Poly-L-Lactic Acid)",
      "Radiesse (Calcium Hydroxylapatite)",
      "Radiesse Plus",
      "Lanluma V",
      "Lanluma X",
      "HArmonyCa",
      "Ellansé S",
      "Ellansé M",
      "Ellansé L",
      "Ellansé E",
    ],
  },
  {
    key: "skin-boosters",
    label: "Skin Boosters & Hydrators",
    products: [
      "Profhilo",
      "Profhilo Body",
      "Profhilo Haenkenium",
      "Sunekos 200",
      "Sunekos 1200",
      "Jalupro",
      "Jalupro HMW",
      "Jalupro Super Hydro",
      "Seventy Hyal 2000",
      "NCTF 135 HA (Filorga)",
      "Restylane Vital",
      "Restylane Vital Light",
      "Viscoderm Hydrobooster",
    ],
  },
  {
    key: "polynucleotides",
    label: "Polynucleotides",
    products: [
      "Plinest",
      "Plinest Eye",
      "Newest",
      "Nucleofill Strong",
      "Nucleofill Medium",
      "Nucleofill Soft",
      "Nucleofill Eyes",
      "Ameela",
      "PhilArt",
    ],
  },
  {
    key: "fat-dissolving",
    label: "Fat Dissolving",
    products: [
      "Aqualyx",
      "DesoFace",
      "DesoBody",
      "Lemon Bottle",
      "Kybella / Belkyra",
    ],
  },
  {
    key: "chemical-peels",
    label: "Chemical Peels",
    products: [
      "Obagi Blue Peel Radiance",
      "ZO 3-Step Peel",
      "SkinCeuticals Advanced Corrective Peel",
      "Mesoestetic Cosmelan",
      "Mesoestetic Dermamelan",
      "Neostrata Glycolic Peel",
      "PRX-T33",
      "BioRePeel",
      "Enerpeel TCA",
    ],
  },
  {
    key: "microneedling",
    label: "Microneedling / Energy",
    products: [
      "SkinPen Precision",
      "Dermapen 4",
      "Genosys Exceed",
      "Morpheus8",
      "Profound RF",
    ],
  },
  {
    key: "prp-prf",
    label: "PRP / PRF",
    products: [
      "Endoret PRGF",
      "Regen Lab PRP",
      "Arthrex Angel PRP",
      "i-PRF",
    ],
  },
  {
    key: "threads",
    label: "PDO / PLLA Threads",
    products: [
      "Aptos Threads",
      "MINT PDO",
      "Silhouette Soft",
      "Croma Mint",
      "Intraline Threads",
    ],
  },
];

const CUSTOM_KEY = "modo:customAestheticProducts";

export function loadCustomProducts(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "{}"); } catch { return {}; }
}

export function saveCustomProduct(categoryKey: string, name: string) {
  const current = loadCustomProducts();
  const list = new Set([...(current[categoryKey] ?? []), name]);
  current[categoryKey] = Array.from(list);
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(current));
}

export function getProductsForCategory(categoryKey: string): string[] {
  const cat = AESTHETIC_PRODUCTS.find((c) => c.key === categoryKey);
  const custom = loadCustomProducts()[categoryKey] ?? [];
  return [...(cat?.products ?? []), ...custom];
}

export const PURPOSE_OPTIONS = [
  "Wrinkle reduction",
  "Volume restoration",
  "Lip enhancement",
  "Cheek augmentation",
  "Jawline contouring",
  "Chin projection",
  "Tear trough correction",
  "Nose reshaping",
  "Skin hydration",
  "Skin tightening",
  "Collagen stimulation",
  "Scar treatment",
  "Pigmentation",
  "Hyperhidrosis",
  "Migraine",
  "Bruxism / masseter",
  "Other",
];
