# Patient Records — Clinical Timeline

A calm, left-rail patient record built around a single chronological **Clinical Timeline** — every visit, consent, form, med, invoice, plan and photo lands on one spine, but nothing merges into a wall of text: each entry is a typed card the practitioner can expand.

## Layout

```text
┌───────────── Patient header (sticky) ──────────────────────────┐
│  Avatar · Name · Age  ·  ⚠ Allergies · Meds · Flags · Next appt │
├──────────────┬─────────────────────────────────────────────────┤
│ Left rail    │  Section content                                │
│              │                                                 │
│ Overview     │  (AI brief + KPIs + next-due)                   │
│ Timeline ◉   │  (default view — the spine)                     │
│ Photos       │  Before/after grid w/ side-by-side compare      │
│ Consents     │  Signed docs, versioned                         │
│ Medical forms│  Intake + review dates                          │
│ Medications  │  Current + history, interactions surfaced       │
│ Plans        │  Active treatment plans / progress              │
│ Invoices     │  Payments, credits, packages                    │
│ Messages     │  Comms log                                      │
│ Files        │  Uploads                                        │
└──────────────┴─────────────────────────────────────────────────┘
```

- **Sticky header** always shows allergies, current meds count, safeguarding flag, next appt. Never buried.
- **Left rail** with counts (e.g. "Consents 4"), active section highlighted, keyboard `g t` / `g p` shortcuts.
- Nothing merges: each section is its own route, own scroll, own empty state.

## Signature features

1. **AI Patient Brief** (Overview) — one-tap "Prep for next visit". Pulls last visit notes, products/doses, unresolved concerns, allergy conflicts, photos, plan progress. Uses Lovable AI (`google/gemini-3-flash-preview`). Server fn `generatePatientBrief` — regenerated on demand, cached per appointment.
2. **Before/After timeline** — Photos tab shows chronological strip; tap two = side-by-side compare with date + treatments-between overlay. Area tags (lips, jawline…) filter the strip.
3. **Patient-facing mirror** — practitioner toggles per-item "Share with patient". Patient app shows a curated view: plan, next-due, aftercare, photos they've approved, invoices, points. Uses existing `patient_accounts`.

## Timeline entry types (typed cards)

Appointment · Consent signed · Medical form submitted · Photo added · Note · Medication prescribed · Invoice/payment · Plan created/updated · Message · Manual event. Filter chips at top of Timeline: All / Clinical / Admin / Photos.

## Data model (additions)

- `patient_timeline_events` — unified view (materialised) over existing tables + a `manual_events` table for practitioner-added entries. Keeps the spine without duplicating source-of-truth data.
- `clinic_clients.share_with_patient` flags per related record (add `shared_with_patient boolean` to: consents, aftercare, plans, invoices, photos).
- `patient_ai_briefs` — cached AI brief per (client_id, appointment_id).
- `client_medications` — structured med list (drug, dose, route, started, stopped, prescriber). Currently only free-text on profile.
- `clinic_clients.safeguarding_flag`, `clinic_clients.gp_details` (jsonb: surgery, address, phone).

All RLS scoped to owning practitioner; grants for `authenticated` + `service_role`.

## Routes

- `/dashboard/patients` — searchable directory (exists, polish).
- `/dashboard/patients/$id` → redirects to `/timeline`.
- `/dashboard/patients/$id/timeline` (default)
- `/dashboard/patients/$id/overview` (AI brief + KPIs)
- `/dashboard/patients/$id/photos`
- `/dashboard/patients/$id/consents`
- `/dashboard/patients/$id/forms`
- `/dashboard/patients/$id/medications`
- `/dashboard/patients/$id/plans`
- `/dashboard/patients/$id/invoices`
- `/dashboard/patients/$id/messages`
- `/dashboard/patients/$id/files`

Under `_authenticated`. Sticky header lives in a `_layout` route with `<Outlet />`.

## Phasing

**Phase 1 (this turn)**
- Migration: `client_medications`, brief cache, sharing flags, GP/safeguarding fields, `manual_events`.
- Route shell + sticky header + left rail + Timeline (aggregated read from existing tables).
- Photos before/after compare.
- Overview with AI brief server fn.

**Phase 2**
- Patient-mirror surface in the patient app.
- Per-item "Share" toggles.
- Manual event composer, richer filters, export.

## Technical notes

- Timeline: single server fn `getPatientTimeline({clientId, cursor, filters})` merging appointments, consents, forms, invoices, photos, meds, plans, manual events into one sorted, paginated stream. RLS via `requireSupabaseAuth` + owner check.
- AI brief: `generatePatientBrief` server fn → Lovable AI gateway, structured output (concerns, red_flags, suggested_questions, last_products). Stored in `patient_ai_briefs`.
- Photos: reuse existing storage bucket; compare view is client-side (two `<img>` + slider). Tags in a small `client_photo_tags` table.
- Left rail counts hydrated once per patient via a `getPatientCounts` server fn to keep the rail snappy.

Confirm and I'll start with Phase 1.
