/**
 * What each clinic role can reach inside the dashboard.
 * Owners see everything. Staff roles use the standard split agreed with MODO:
 * admin = everything except owner-only areas, practitioner = clinical + own
 * calendar, receptionist = front-of-house, viewer = read-only.
 */
export type ClinicRole = "owner" | "admin" | "practitioner" | "receptionist" | "viewer";

/** Never visible to any staff member — clinic owner only. */
export const OWNER_ONLY_ROUTES = [
  "/dashboard/billing",
  "/dashboard/payments",
  "/dashboard/clinic",
  "/dashboard/branding",
  "/dashboard/about",
  "/dashboard/policies",
  "/dashboard/staff",
  "/dashboard/associates",
  "/dashboard/room-rental",
];

const PRACTITIONER_ROUTES = [
  "/dashboard",
  "/dashboard/bookings",
  "/dashboard/upcoming",
  "/dashboard/new-appointment",
  "/dashboard/patients",
  "/dashboard/consultations",
  "/dashboard/availability",
  "/dashboard/services",
  "/dashboard/packages",
  "/dashboard/addons",
  "/dashboard/medical-forms",
  "/dashboard/consent-forms",
  "/dashboard/pre-treatment",
  "/dashboard/aftercare",
  "/dashboard/form-allocation",
  "/dashboard/reviews",
  "/dashboard/compliance",
  "/dashboard/menu",
  "/dashboard/help",
];

const RECEPTIONIST_ROUTES = [
  "/dashboard",
  "/dashboard/bookings",
  "/dashboard/upcoming",
  "/dashboard/new-appointment",
  "/dashboard/patients",
  "/dashboard/availability",
  "/dashboard/invoices",
  "/dashboard/gift-cards",
  "/dashboard/discounts",
  "/dashboard/reviews",
  "/dashboard/compliance",
  "/dashboard/menu",
  "/dashboard/help",
];

const VIEWER_ROUTES = [
  "/dashboard",
  "/dashboard/bookings",
  "/dashboard/upcoming",
  "/dashboard/patients",
  "/dashboard/menu",
  "/dashboard/help",
];

export function canAccessRoute(role: ClinicRole, to: string): boolean {
  if (role === "owner") return true;
  if (OWNER_ONLY_ROUTES.includes(to)) return false;
  if (role === "admin") return true;
  const allowed =
    role === "practitioner"
      ? PRACTITIONER_ROUTES
      : role === "receptionist"
        ? RECEPTIONIST_ROUTES
        : VIEWER_ROUTES;
  return allowed.includes(to);
}

export const ROLE_LABEL: Record<ClinicRole, string> = {
  owner: "Owner",
  admin: "Clinic admin",
  practitioner: "Practitioner",
  receptionist: "Receptionist",
  viewer: "Viewer",
};
