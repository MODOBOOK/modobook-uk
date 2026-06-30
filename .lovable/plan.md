## Goal
Replace the "Book an in-person consultation" routing (which sent patients off to the prescriber's own booking page) with **Clinic Visit Days** — preset days when a prescriber will be present at the practitioner's clinic. Patients stay on the practitioner's booking page and pick an available visit slot; the prescriber sees a unified rota of where they'll be and who's booked.

## What the user gets

**Practitioner (Prescriber Hub → Connections / Prescribing):**
- For each linked prescriber, schedule "Clinic visit days": date, start/end time, location (if multi-site), capacity, optional note.
- Per treatment, the routing options become: *Same address* · *Clinic visit days* (replaces *In-person consult*).
- View, edit, cancel upcoming visits; see how many patients are booked into each.

**Prescriber (Prescriber workspace → Visits):**
- New "Clinic visits" page listing every upcoming visit across all linked practitioners — clinic name, address, date/time, list of patients booked, notes.
- Can propose / confirm / decline visits (mirrors the practitioner's schedule).

**Patient (booking flow):**
- When a treatment requires a prescriber and routing is *Clinic visit days*, the booking page shows the next available visit slots from that prescriber at this clinic and asks the patient to pick one (instead of redirecting away).
- Consent gate still applies. Booking confirmation references the prescriber visit.

## Technical plan

**New table** `prescriber_clinic_visits`
- `id`, `practitioner_profile_id`, `prescriber_user_id`, `location_id` (nullable), `visit_date`, `start_time`, `end_time`, `capacity` (default 8), `notes`, `status` (`scheduled` | `cancelled`), `created_by` (`practitioner` | `prescriber`), `confirmed_by_prescriber` (bool), timestamps. GRANTs + RLS: practitioner can manage their own; linked prescriber can SELECT + UPDATE status/confirmed flag; patients get a SECURITY DEFINER RPC for public read.

**Schema additions**
- `prescriber_referrals.clinic_visit_id uuid null` — links a referral to the chosen visit.
- Extend `treatments.prescriber_routing` allowed values to include `clinic_visit` (keep existing rows valid; treat legacy `in_person_consult` as `clinic_visit` in the UI).

**RPCs**
- `list_prescriber_visits_for_slug(p_slug, p_treatment_ids)` — public; returns upcoming visits + remaining capacity for the treatments' prescribers at that clinic.
- `book_prescriber_visit(p_referral_id, p_visit_id)` — capacity check + link.

**Server functions** (`src/lib/prescriber-visits.functions.ts`)
- `listClinicVisits` (practitioner) · `upsertClinicVisit` · `cancelClinicVisit`
- `listMyPrescriberVisits` (prescriber view, with booked patients)
- `listAvailableVisitsForBooking` (patient, wraps RPC)

**UI**
- `src/routes/_authenticated/hub.visits.tsx` — manage visit days (shared layout; role-aware: prescriber sees rota, practitioner sees scheduler).
- Update `hub.prescribing.tsx`: rename routing option, replace radio label.
- Update `m.$slug.book-multi.tsx`: replace the "Book consultation with prescriber →" block with a visit picker driven by `listAvailableVisitsForBooking`; gate the Confirm button until each clinic-visit treatment has a slot selected.
- Add a "Clinic visits" tile to both hub indexes.

**Backward compatibility**
- Migrate any existing `prescriber_routing = 'in_person_consult'` rows to `clinic_visit`. Keep the enum/text accepting both for one release; UI shows the new label.

## Out of scope
- Reminders/notifications to prescriber about upcoming visits (existing reminder pipeline can be wired later).
- Patient-facing rescheduling of which visit they're assigned to (practitioner can reassign).
