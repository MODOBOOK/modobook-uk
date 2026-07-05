
## 1. Time off — multi-select picker

Enhance the existing Time-off tab on `dashboard.availability.tsx` with a single "Add time off" dialog that lets the user pick:

- **Individual dates** — click days on a calendar (multi-select mode)
- **Date range** — from → to (range mode)
- **Whole week(s)** — click a week to select Mon–Sun (week mode)
- **Timed block on one day** — start/end times (existing)

Under the hood everything still writes to the existing `blocked_dates` (all-day) and `blocked_times` (timed) tables — the dialog just expands a selection into multiple `blocked_dates` inserts in one go. No schema change needed.

UI: a mode toggle (Days · Range · Weeks · Time block), a `Calendar` with the matching `mode`, an optional reason, and location filter. Confirm inserts every selected date and refreshes the list.

## 2. Staff & permissions

### Roles (app-level, not clinical `practitioners`)

New enum `staff_role`: `admin`, `practitioner`, `receptionist`, `viewer`.

- **admin** — full dashboard access (settings, staff, billing). Not bookable — never appears in practitioner pickers.
- **practitioner** — bookable clinician; sees own calendar + patients; edits own availability. Linked to a `practitioners` row.
- **receptionist** — manages bookings & patients; no clinical notes; not bookable.
- **viewer** — read-only across schedule & patients.

Data scope note: you said "manager decides", so we add a **`data_scope`** column per staff row: `clinic` (see everything) or `own` (practitioners only see their own). Admin toggles it when inviting/editing.

### Schema

```text
staff_members
  id, profile_id (owner clinic), user_id (nullable until accepted),
  invited_email, name, role staff_role, data_scope ('clinic'|'own'),
  practitioner_id (nullable, only for role=practitioner),
  status ('invited'|'active'|'disabled'),
  invited_at, accepted_at, invite_token, invite_expires_at

+ helper fn: has_staff_role(_user_id, _profile_id, _role) SECURITY DEFINER
+ helper fn: staff_profile_id(_user_id) -> the clinic this staff belongs to
```

RLS: the clinic owner (existing `profiles.user_id`) manages their `staff_members`. A staff `user_id` can read their own row.

Existing RLS on clinical tables (`appointments`, `clinic_clients`, etc.) currently scopes by `profile_id = <owner>`. To let staff act on their clinic's data we extend those policies with `OR user is active staff of that profile_id`. This is a wide change — we'll do it via a single helper `is_clinic_member(profile_id)` used by all policy updates so it stays consistent.

### Invite flow

1. Admin opens **Settings → Staff**, clicks *Invite*, fills email + name + role + scope (+ practitioner link if role=practitioner).
2. Server fn creates a `staff_members` row (`status=invited`, random `invite_token`, 7-day expiry) and sends the magic-link email via existing app-email infrastructure with template `staff-invite`.
3. Recipient clicks link → `/staff-accept/$token` → signs up / signs in → server fn matches token, sets `user_id`, `status=active`.
4. On next login they land in the owner clinic's dashboard. Their role gates UI (hide Settings/Billing for non-admins, hide clinical notes for receptionist, disable edits for viewer).

### UI

New route `dashboard.staff.tsx`:
- Staff list (name, email, role badge, scope, status, last active)
- Invite dialog
- Edit dialog (change role / scope / disable / revoke)
- Resend invite

Sidebar nav item "Staff" visible only to admin + owner.

Practitioner picker (booking, availability, etc.) already reads `practitioners`. Admins without a `practitioner_id` never appear there — no change required, just don't auto-create a practitioner row for admin invites.

## Out of scope
- Per-record ACLs beyond role + data_scope
- Two-factor for staff
- Audit log UI (rows will still be written but no viewer this pass)
- Migrating existing `practitioners` rows into `staff_members` — those stay as clinical entities; staff invites are a parallel table linked by `practitioner_id`.

## Rollout order
1. Time-off multi-select dialog (frontend only, no migration).
2. Migration: `staff_members` + helpers + `is_clinic_member`.
3. Extend RLS on the tables staff need (appointments, clinic_clients, availability, treatments read).
4. Server fns: `listStaff`, `inviteStaff`, `updateStaff`, `revokeStaff`, `acceptStaffInvite`.
5. Email template `staff-invite`.
6. `/dashboard/staff` route + invite dialog.
7. `/staff-accept/$token` public route.
8. Role-based UI gating in sidebar + settings pages.

Confirm and I'll build in that order (part 1 first as a quick win, then the staff system as a follow-up commit).
