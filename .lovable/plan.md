# Workspace switcher for one login, many roles

## Problem

Auth uses one account per email. When you accepted the staff invite with your personal email, it signed you back into your existing owner account instead of creating a second one. The fix is to stop treating "owner" and "staff-view-only" as different accounts and instead treat them as **workspaces the same account can switch between**.

## What the user will see

- A workspace picker in the dashboard header (top-left, next to the MODO mark).
- It lists:
  - "My clinic" (their own practitioner profile), if they have one.
  - Every practitioner who has invited them as staff, with the role badge (View only, Manager, etc.).
- Picking a workspace reloads the dashboard scoped to that practitioner. All lists (bookings, clients, revenue, aftercare, etc.) show that workspace's data only.
- View-only staff see the dashboard in read mode: edit / create / delete buttons are hidden, and any write action shows "You have view-only access".
- The staff invite acceptance flow no longer tries to create a new auth account. If the email already has one, it just links the staff membership to the existing account and tells the user "You've been added — switch to {Clinic name} from the workspace menu".

## How it works (technical)

1. **Active workspace** stored in `localStorage` (`modo.activeWorkspaceId`) + a React context (`WorkspaceProvider`) at the `_authenticated` layout. Default = owner's own practitioner id; falls back to first staff membership.
2. **Resolver hook** `useActiveWorkspace()` returns `{ practitionerId, role, isOwner, canWrite }`. All existing dashboard queries switch from "my practitioner id" → `practitionerId` from this hook.
3. **Staff membership lookup**: new server fn `listMyWorkspaces` returns own practitioner + rows from `staff_members` where `user_id = auth.uid()` and `status = 'active'`, joined to the inviting practitioner's name/avatar.
4. **Write-guard**: `canWrite` = `isOwner || role in ('manager','admin')`. UI hides write controls; server fns already enforce practitioner ownership via RLS, so view-only staff simply can't mutate.
5. **Staff-accept route** (`/staff-accept/:token`):
   - If already signed in → link membership to current user, redirect to `/dashboard` with a toast to switch workspace.
   - If signed out with an email that already has an account → send to `/auth` with `?next=/staff-accept/:token`, then link on return.
   - If brand-new email → normal sign-up, then link.
   No more `supabase.auth.signUp` attempts on existing emails.
6. **Header switcher component**: dropdown showing workspaces, active one checked, role badge on each.

## Files touched

- New: `src/lib/workspaces.functions.ts`, `src/context/WorkspaceContext.tsx`, `src/components/WorkspaceSwitcher.tsx`.
- Edited: `src/routes/_authenticated.tsx` (wrap in provider), dashboard header, `src/routes/staff-accept.$token.tsx`, and the ~6 dashboard queries that hard-code the owner's practitioner id.
- Migration: add `user_id` (nullable, fk to auth.users) and `status` to `staff_members` if not already present, plus RLS policy `staff_members_self_read` so a signed-in user can see their own memberships.

## Out of scope for this change

- Per-role granular permissions beyond view-only vs full (manager/admin distinction stays as-is).
- Cross-workspace notifications badge.
- Owner-side "seat billing" changes.

Confirm and I'll build it.
