
# Prescriber referral flow

## 1. Database

New + altered schema (one migration):

- `treatments` — add `requires_prescriber boolean default false`, `prescriber_user_id uuid` (FK auth.users, the connected prescriber for this service), `prescriber_routing text check in ('same_address','in_person_consult') default 'same_address'`, `prescriber_note text`.
- `prescriber_referrals` (new):
  - `practitioner_profile_id`, `prescriber_user_id`, `treatment_id`, `appointment_id` (nullable — set once patient books), `client_id` (nullable until linked)
  - `patient_name`, `patient_email`, `patient_phone`, `patient_dob`
  - `routing` ('same_address' | 'in_person_consult')
  - `status` ('pending' | 'accepted' | 'declined' | 'completed')
  - `consent_given_at`, `accepted_at`, `declined_at`, `notes`
- Indexes on `prescriber_user_id, status` and `practitioner_profile_id`.
- GRANTs to `authenticated` + `service_role`.
- RLS:
  - Practitioner can read/write referrals on their `profile_id`.
  - Prescriber (`auth.uid() = prescriber_user_id`) can read all their referrals (minimal columns implicit — UI controls what's shown) and update status.
  - SECURITY DEFINER fn `prescriber_get_referral_full(referral_id)` returns medical forms + consultation rows ONLY when status='accepted' AND caller is the prescriber. Used by the "full record" view.
- Trigger: when `appointment` is inserted and `treatment.requires_prescriber`, auto-create a `prescriber_referrals` row (status='pending') and link `appointment_id`.

## 2. Practitioner side — Services editor

In `dashboard.services.*` treatment edit panel, add a "Prescriber" section:
- Toggle: **Requires a prescriber**
- Dropdown: **Assigned prescriber** — populated from `hub_links` where the other party is an approved prescriber.
- Radio: **Routing**
  - *Same address — no extra booking* (default): patient just consents; prescriber sees the referral on their dashboard before the appointment.
  - *In-person consult at prescriber's clinic*: patient is redirected to the prescriber's `/m/{slug}` booking page after consenting, then returns.
- Optional note shown to patient at the consent step.

If `requires_prescriber=true` but no prescriber assigned → inline warning, save blocked.

## 3. Patient side — Booking flow

In `m.$slug.index.tsx` after treatment selection, before slot/payment:
- If any selected treatment has `requires_prescriber`, insert a **Prescriber consent step**:
  - Card per service explaining: "This treatment requires a prescriber ({prescriber_display_name}). To proceed we need to share your details and medical info with them."
  - Checkbox: **I consent to sharing my details and medical forms with the prescriber.** (required to continue)
  - If routing = `in_person_consult`: button **Book consultation with prescriber** opens prescriber's booking page in a new tab; second checkbox **I've booked / completed my prescriber consultation** required.
  - If routing = `same_address`: just consent, then continue to normal booking.
- On final booking submit, `consent_given_at` is stamped on the auto-created referral via the appointment trigger.

## 4. Prescriber dashboard

New route `/_authenticated/hub.referrals.tsx`:
- Two tabs: **Pending** / **Accepted & history**.
- Pending row (minimal tier): patient first name + initial, treatment name, referring practitioner clinic name, requested date. Buttons: **Accept case** / **Decline**.
- On Accept → status='accepted', `accepted_at=now()`. Row expands to full record drawer:
  - Full name, DOB, contact, address
  - All submitted medical form responses (rendered)
  - Any consultation notes attached to the patient
  - Link to the appointment
- Mark **Complete** when prescribing decision made; adds an internal note.

Add link in hub sidebar + a "Pending referrals" stat to `hub.index.tsx`.

## 5. Hub at the centre

- `dashboard.index.tsx`: add a **Prescriber Hub** hero card at the top (above existing shortcuts) showing: MODO code, connected count, pending referrals count, CTA to open Hub. Card stays for both practitioners and prescribers.
- Sidebar: pin "Prescriber Hub" to the top of the nav (above Calendar).

## Out of scope (call out)

- No payment splitting between prescriber and practitioner.
- No automated email to prescriber on new referral yet (dashboard badge only). Email triggers can be added later.
- "Same address" doesn't yet auto-create a calendar block for the prescriber — they see the referral, not a separate appointment.

## Files touched

- New migration
- `src/lib/prescriber.functions.ts` (new)
- `src/routes/_authenticated/hub.referrals.tsx` (new)
- `src/routes/_authenticated/hub.index.tsx` (stat + link)
- `src/routes/_authenticated/hub.tsx` (tab)
- `src/routes/_authenticated/dashboard.index.tsx` (hero card)
- Services editor component (prescriber section)
- `src/routes/m.$slug.index.tsx` (consent step + redirect to prescriber slug)
- Sidebar component (Hub pinned to top)
