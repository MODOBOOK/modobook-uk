## Goal
Rebuild the Availability page so weekly hours are visualised as a grid, and each rule can repeat on a **rota** (every week, A/B fortnight, or up to a 4-week A/B/C/D cycle). Each rule keeps its own location and (optionally) practitioner.

## New concepts
- **Rota cycle**: 1, 2, or 4 weeks. Default `1` = every week (current behaviour, no change for existing users).
- **Week in cycle**: which weeks a rule is active. Stored as a bitmask of week letters (A=1, B=2, C=4, D=8). Example: A+C on a 4-week rota = `5`.
- **Anchor date**: a single fixed Monday saved on the profile. "Which letter is this week" is computed as `floor(weeksSince(anchor) / 1) % cycleLength`. That way A/B/C/D stays stable across devices without any per-rule date field.

## Database changes
`availability_rules` — add:
- `cycle_length smallint not null default 1` (1, 2, or 4)
- `weeks_mask smallint not null default 1` (bitmask; `1` means "week A only", which for cycle=1 = every week)
- `practitioner_id uuid null` (optional — for multi-practitioner clinics; nullable so single-user setups ignore it)

`profiles` — add:
- `rota_anchor_date date` (nullable; set to the Monday of the week the user first enables a >1 cycle)

Same fields added to `availability_overrides` isn't needed — overrides remain one-off dates.

Availability generation in `public-booking.functions.ts` gets a helper: given a date, compute `letter = floor(daysSince(anchor)/7) % cycleLength`, then include a rule only if `weeks_mask & (1<<letter)` is set. Also filter by `practitioner_id` when the booking flow passes one.

## UI (`dashboard.availability.tsx`)
Three-tab layout, mobile-first:

1. **Weekly hours** (default)
   - Top control: **Rota cycle** dropdown — "Every week / Every 2 weeks (A, B) / 4-week rota (A, B, C, D)". Shows a small "This week = B" chip.
   - **Grid**: 7 columns (Mon–Sun) × cycle rows (A only, or A/B, or A/B/C/D). Each cell shows the shifts for that day+week with a coloured location dot. Tap a cell → sheet to add/edit/delete shifts (time range, location, optional practitioner, slot interval).
   - Rules list underneath — same data, flat readable form ("Mon 9:00–17:00 · Harley St · Week A only").

2. **One-off dates** — existing overrides UI, unchanged.
3. **Time off** — existing blocked dates + blocked times, unchanged.

## Server functions
- `upsertAvailabilityRule` accepts `cycle_length`, `weeks_mask`, `practitioner_id`.
- New `setRotaAnchor({ date })` — called once when the user first picks cycle > 1.
- Booking-side `getDayAvailability` respects the mask.

## Out of scope for this pass
- Editing existing multi-location pricing.
- Practitioner assignment UI beyond a dropdown on each shift (uses existing `practitioners` table).
- Migrating locked historic bookings — new rules only affect future slot generation.

## Technical notes
- Existing rows migrate cleanly: `cycle_length=1, weeks_mask=1` = "every week", identical to today's behaviour. No data backfill needed.
- Bitmask keeps the schema tiny (one small int) and lets a rule apply to arbitrary combos like "A and C only".
- Anchor date being on the profile (not per-rule) means renumbering (A becomes B) never happens accidentally when a user edits one shift.
