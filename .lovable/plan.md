## Goal

Let patients tick multiple packages the same way they already tick multiple treatments on `/m/{slug}`, mix packages and treatments in a single selection, and take them all through checkout together.

## Customer menu (`m.$slug.index.tsx`)

- Add a `selectedPackageIds` state next to the existing `selectedIds` and a "Select" toggle in the top-right of every package card (same visual style as the treatment card's check button).
- Clear both arrays when the location changes.
- Sticky bottom bar (currently "N treatments selected"):
  - Show combined count, e.g. `2 treatments · 1 package`.
  - Total = sum of treatment prices + sum of package prices (first-session for packages counts once).
  - "Continue" links to `/m/$slug/book-multi` with a new search shape: `?ids=<treatmentIds>&pkgs=<packageIds>`.

## Booking flow (`m.$slug.book-multi.tsx`)

- Extend `searchSchema` with `pkgs: z.string().optional()`; forward `packageIds` into the loader.
- Update `getMultiBookingContext` (server fn) to accept `packageIds` and return the selected package rows joined with their included treatments so the page can render them alongside treatments.
- Render a "Packages" block above the treatments list on the review step, each with sessions/price/included-treatments summary.
- Duration/timeslot logic: only the first session of each package is booked in this appointment (existing single-package behaviour); subsequent sessions remain to be scheduled after purchase — surface a small note under the package block.
- Totals, deposit, and Stripe line items include package prices; add-ons continue to attach to treatments only.
- `redirectPath` (auth bounce) preserves both `ids` and `pkgs` params.

## Checkout persistence

- When creating the appointment(s), keep the current treatment appointments as-is and additionally insert one `package_purchases` row per selected package (owner = patient, package_id, sessions_remaining = session_count − 1, expires_at from `expiry_days`).
- If the package has a `treatment_ids[0]`, create the first-session appointment against that treatment and mark it as the first redeemed session; otherwise create a placeholder appointment with `notes = "Package: <name> — session 1 of N"`.
- Confirmation email lists purchased packages plus booked treatments.

## Technical notes

- Files touched: `src/routes/m.$slug.index.tsx`, `src/routes/m.$slug.book-multi.tsx`, `src/lib/booking.functions.ts` (multi-context loader + create-appointment path), `src/lib/packages.functions.ts` (only if we add a helper for expanding packages).
- No schema changes required — `package_purchases` and existing appointment columns are sufficient.
- Type-safe search params: use `zodValidator(fallback(...))` per project convention.
- The existing "Book" button on each package card stays for users who want a single package flow; the new checkbox is purely additive.

## Out of scope

- Scheduling all package sessions at checkout (still a follow-up flow).
- Applying discount codes to packages.
- Add-ons on packages.
