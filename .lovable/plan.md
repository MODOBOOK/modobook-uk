# Platform Admin Console — Phase 1

Goal: give platform admins real control *outside* the practitioner booking system, so they can never accidentally take a booking or touch patient data. Phase 1 lays the foundation everything else (billing, moderation, feature flags) will sit on.

## Scope of Phase 1

1. A separate admin surface at `/admin/*` (top-level, gated by `has_role('admin')`), styled distinctly from the practitioner dashboard so it never feels like "the booking app". Later this can be lifted onto an `admin.modobook.uk` subdomain — the routes and RPCs stay identical, only DNS + a root-level guard change.
2. Admin console shell: sidebar with Practitioners, Subscriptions, Content, Feature flags, Audit log, Broadcasts, Prescriber verifications (the existing page moves here). Distinct header ("Modo Admin"), no booking UI chrome.
3. **Practitioner directory**: searchable list of every profile — name, clinic, slug, plan, active/suspended, created, last sign-in. Row actions: View as, Reset (see below), Suspend/Reactivate, Open billing (stub in Phase 1).
4. **View-as (read-only mirror)**: opens `/admin/practitioners/$id/view` which server-side fetches that practitioner's public page + a read-only snapshot of their dashboard config (branding, treatments, hours, locations — **no clients, no appointments, no consultations, no forms, no prescriptions**). Persistent red banner "Viewing as {name} — read only, no patient data". No impersonation of their auth session.
5. **Reset / edit-for-practitioner (safe subset)**: admins can edit branding/theme, treatment names & prices, locations, hours, public bio, and clear their onboarding flags. Nothing that touches a person's health record.
6. **Audit log**: every sensitive admin action (view-as open, edit-for, suspend, plan change later, moderation later) writes a row with actor, target profile, action, diff, ip hash, ts. New `/admin/audit` page to browse/filter.

## Patient data — recommendation

Do **not** expose patient data in the admin console, even read-only. Regulatory + trust cost is huge, and the practitioner is the data controller — Modo shouldn't be casually browsing their patients. Two narrow exceptions we should build later, not now:
- **Break-glass export**: on a written support request, an admin can trigger a signed, logged export delivered to the practitioner's verified email — admin never sees it in the UI.
- **Deletion / GDPR erasure**: admin can delete a client record by id on request, logged.

Both go through the audit log with a mandatory reason field. Phase 1 just wires the log; the actions come later.

## Technical section

### Routes
- `src/routes/_admin/route.tsx` — new pathless layout. `beforeLoad` calls `amIAdmin()`; redirects to `/` if not admin. `ssr: false`. Renders `<AdminShell><Outlet /></AdminShell>`.
- `src/routes/_admin/admin.index.tsx` — dashboard (counts: practitioners, active subs, pending verifications, recent audit events).
- `src/routes/_admin/admin.practitioners.tsx` — directory.
- `src/routes/_admin/admin.practitioners.$id.tsx` — profile detail w/ tabs: Overview, View as, Edit, Audit.
- `src/routes/_admin/admin.practitioners.$id.view.tsx` — read-only mirror.
- `src/routes/_admin/admin.audit.tsx` — audit log browser.
- Existing `/admin-prescribers` moves under `/_admin/admin.prescribers.tsx`; old route redirects.

### DB (one migration)
```sql
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  target_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,           -- 'view_as_open' | 'profile_edit' | 'suspend' | ...
  reason text,
  diff jsonb,                     -- before/after for edits
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);
grant select, insert on public.admin_audit_log to authenticated;
grant all on public.admin_audit_log to service_role;
alter table public.admin_audit_log enable row level security;
create policy "admins read audit" on public.admin_audit_log for select
  to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins insert audit" on public.admin_audit_log for insert
  to authenticated with check (public.has_role(auth.uid(), 'admin') and actor_user_id = auth.uid());
create index on public.admin_audit_log (created_at desc);
create index on public.admin_audit_log (target_profile_id, created_at desc);
```
Reuses existing `has_role` + `user_roles` — no role model changes.

### Server fns (new `src/lib/admin-console.functions.ts`)
All `.middleware([requireSupabaseAuth])` + inline `assertAdmin`. Each mutating fn writes an `admin_audit_log` row in the same transaction (via RPC helper `admin_log_action`).
- `adminListPractitioners({ q, status, plan, cursor })` — server-side search/paginated.
- `adminGetPractitioner({ id })` — profile + branding + counts (no PHI).
- `adminViewAsSnapshot({ id })` — safe read: profile, clinic_theme, treatments, treatment_categories, locations, availability_rules. Logs `view_as_open`.
- `adminEditPractitioner({ id, patch, reason })` — allow-listed columns only (clinic_name, slug, bio, theme fields, active). Diff logged.
- `adminSetActive({ id, active, reason })` — suspend/reactivate. Logged.
- `adminListAudit({ target_id?, actor_id?, action?, cursor })`.

### UI
- `src/components/admin/AdminShell.tsx` — dark sidebar, distinct "Modo Admin" wordmark, current admin's name, sign-out.
- `src/components/admin/ViewAsBanner.tsx` — sticky red banner with "Exit view-as".
- Directory uses TanStack Query + a debounced search box; row actions in a dropdown.
- Edit-for form reuses the branding editor's field components, wrapped in a "Reason for change" required textarea.

### Not in Phase 1 (explicitly deferred)
- Subscription/billing actions (plan change, comp, refund) — Phase 2, needs Stripe surface work.
- Content moderation (hide reviews, pages, images) — Phase 3.
- Feature flags & per-account caps — Phase 4, needs a `feature_flags` table.
- Subdomain split to `admin.modobook.uk` — Phase 5, DNS + hosting.
- Any patient/appointment/consultation/prescription/form read surface.

### Files touched
- New: migration, `src/lib/admin-console.functions.ts`, 6 new route files, `AdminShell`, `ViewAsBanner`, admin directory/detail/view/edit/audit page components.
- Edited: `src/routes/_authenticated/admin-prescribers.tsx` → move + redirect stub, root nav (add "Admin" link visible only when `amIAdmin`).
