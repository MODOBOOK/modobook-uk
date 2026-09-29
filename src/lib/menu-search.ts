import type { MenuItem } from "./menu-groups";

// Extra words each page should answer to, so clinics can search the word
// THEY use ("botox", "rota", "texts") rather than the exact menu label.
const KEYWORDS: Record<string, string[]> = {
  "/dashboard": ["home", "overview", "today", "main"],
  "/dashboard/ai-import": ["import", "upload", "setup", "pdf", "migrate", "fresha", "switch"],
  "/dashboard/clinic": ["profile", "business", "name", "contact", "social", "instagram", "phone", "email", "address"],
  "/dashboard/about": ["story", "bio", "about me"],
  "/dashboard/branding": ["colour", "color", "logo", "font", "brand", "favicon", "theme", "look"],
  "/dashboard/appearance": ["theme", "dark mode", "workspace", "dashboard colours"],
  "/dashboard/policies": ["welcome", "deposit", "cancellation", "terms", "policy", "intro", "notice", "t&cs"],
  "/dashboard/locations": ["address", "clinic", "map", "branch", "venue"],
  "/dashboard/practitioners": ["team", "photo", "title", "who treats"],
  "/dashboard/staff": ["team", "invite", "rota", "member", "pay", "employee"],
  "/dashboard/compliance": ["audit", "checks", "fridge", "cleaning", "regulated", "his", "inspection"],
  "/dashboard/associates": ["self employed", "rent a chair", "oversight", "associate"],
  "/dashboard/room-rental": ["room", "rent", "hire", "space", "let"],
  "/hub/find-prescriber": ["prescriber", "nurse prescriber", "v300", "connect", "find"],
  "/dashboard/services": ["treatments", "prices", "pricing", "categories", "botox", "filler", "menu", "rearrange", "order"],
  "/dashboard/addons": ["extras", "upsell", "add ons"],
  "/dashboard/packages": ["bundle", "course of treatments", "package"],
  "/dashboard/discounts": ["promo", "code", "voucher", "offer", "sale", "money off"],
  "/dashboard/gift-cards": ["voucher", "gift", "present"],
  "/dashboard/memberships": ["subscription", "plan", "recurring", "member", "savings pot"],
  "/dashboard/model-slots": ["model", "discounted", "cheap", "training slots"],
  "/dashboard/medical-forms": ["questionnaire", "health", "form", "medical history"],
  "/dashboard/consent-forms": ["consent", "signature", "form", "agreement"],
  "/dashboard/pre-treatment": ["advice", "before", "preparation", "prep"],
  "/dashboard/aftercare": ["aftercare", "post treatment", "follow up"],
  "/dashboard/form-allocation": ["attach", "allocate", "assign forms", "link forms"],
  "/dashboard/training": ["course", "teach", "academy", "student", "delegate"],
  "/dashboard/booking-flow": ["concerns", "quiz", "picker", "booking questions"],
  "/dashboard/availability": ["hours", "opening", "times", "slots", "schedule", "rota", "day off", "block"],
  "/dashboard/upcoming": ["appointments", "diary", "schedule", "bookings", "briefs"],
  "/dashboard/new-appointment": ["book", "add appointment", "manual booking", "book client in"],
  "/dashboard/consultations": ["records", "notes", "clinical", "face map"],
  "/dashboard/patients": ["clients", "customers", "records", "csv", "import", "notes"],
  "/dashboard/waitlist": ["waiting list", "cancellation list", "fully booked"],
  "/dashboard/reviews": ["feedback", "ratings", "testimonials", "stars", "google review"],
  "/dashboard/rewards": ["loyalty", "points", "referral", "recommend", "tiers"],
  "/dashboard/payments": ["stripe", "payout", "card", "bank", "money", "capture", "refund"],
  "/dashboard/products": ["stock", "retail", "inventory", "product costs"],
  "/dashboard/expenses": ["costs", "rent", "bills", "outgoings", "spending"],
  "/dashboard/income": ["revenue", "earnings", "takings", "money in"],
  "/dashboard/billing": ["plan", "subscription", "modo plan", "direct debit", "solo", "collective", "upgrade"],
  "/dashboard/invoices": ["bills", "modo invoice", "arrears", "receipts"],
  "/dashboard/notifications/email": ["emails", "reminders", "templates", "confirmation", "automated"],
  "/dashboard/notifications/sms": ["texts", "text messages", "reminders", "sms"],
  "/dashboard/marketing": ["campaign", "newsletter", "email blast", "promote", "advertise"],
  "/dashboard/marketing/sms": ["text blast", "sms campaign", "bulk text"],
  "/dashboard/settings": ["booking rules", "notice", "buffer", "deposit", "reminder", "settings", "card capture"],
  "/dashboard/bookings": ["calendar", "month", "diary", "schedule"],
  "/dashboard/analytics": ["stats", "performance", "reports", "figures"],
  "/dashboard/income-report": ["revenue", "report", "takings", "breakdown"],
  "/dashboard/commission-report": ["commission", "split", "associate pay"],
  "/dashboard/staff-analytics": ["team performance", "practitioner stats"],
  "/hub": ["prescriber", "hub", "prescribing"],
  "/dashboard/rx-requests": ["prescription", "rx", "prescribing requests"],
  "/dashboard/referrals": ["prescriber referrals", "referrals"],
  "/dashboard/help": ["help", "faq", "support", "guides", "how to"],
  "/admin": ["admin", "platform"],
};

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim();
}

// Edit distance capped at max — used for typo tolerance on single words.
function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j++) {
      const cur = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = cur;
      if (prev[j] < rowMin) rowMin = prev[j];
    }
    if (rowMin > max) return false;
  }
  return prev[b.length] <= max;
}

// How well one query word matches one haystack word.
function wordScore(q: string, w: string): number {
  if (w === q) return 4;
  if (w.startsWith(q) || q.startsWith(w)) return 3;
  if (w.includes(q)) return 2;
  // Typo tolerance only when the word is long enough for it to be meaningful.
  if (q.length >= 4 && within(q, w, q.length >= 7 ? 2 : 1)) return 1;
  return 0;
}

export type MenuSearchResult = MenuItem & { group: string };

/**
 * Forgiving page search for the practitioner dashboard. Every word typed
 * must match something (label, description, keywords or group), but a match
 * can be a part-word or a small typo. Results are ranked best-first.
 */
export function searchMenuItems(
  query: string,
  groups: { title: string; items: MenuItem[] }[],
): MenuSearchResult[] {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(" ").filter(Boolean);
  const scored: { item: MenuSearchResult; score: number }[] = [];

  for (const g of groups) {
    for (const item of g.items) {
      const label = norm(item.label);
      const rest = norm(
        `${item.description} ${(KEYWORDS[item.to] ?? []).join(" ")} ${g.title}`,
      );
      const labelWords = label.split(" ");
      const restWords = rest.split(" ");
      let total = 0;
      let ok = true;
      for (const t of tokens) {
        const best = Math.max(
          ...labelWords.map((w) => wordScore(t, w) * 2), // label matches count double
          ...restWords.map((w) => wordScore(t, w)),
        );
        if (best === 0) { ok = false; break; }
        total += best;
      }
      if (ok) scored.push({ item: { ...item, group: g.title }, score: total });
    }
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.item);
}
