# Revised: safe path for staff view-only access

## Why the original plan is too risky in one turn

Your data model scopes everything by `profile_id = auth.uid()` — 40+ server functions and every RLS policy. A full workspace switcher means rewriting all of them plus adding staff-SELECT policies to every table. That's not safe to do in one pass.

## Recommended path — two phases

### Phase 1 (now): fix the specific bug the user hit

The confusing bit was: staff invite acceptance silently signed you into your existing owner account, so it *looked* like nothing happened. That's a UX problem I can fix cleanly.

- On the invite-accept page, when the email already has an account, stop trying to `signUp` + `signInWithPassword` silently. Instead show a clear card: **"An account already exists for {email}. Sign in to link this invite to that account."** with a Sign-in button and a "Use a different email" link.
- After sign-in returns to `/staff-accept/:token`, call `acceptStaffInvite` (which just writes the `staff_members` row with `user_id = auth.uid()`), then land on a new page `/dashboard/invites` that lists the clinics you've been added to with a clear "You have view-only access — full switching coming soon" note.
- Add a **red banner** on the invite page when it detects the invited email is already the currently-signed-in owner's own email, saying "You can't invite your own owner email as staff — use a different email or a `+viewer` alias."

Result: no more surprise "logged into the wrong account" moment, and staff memberships are still recorded correctly for phase 2.

### Phase 2 (separate change, later): the real switcher

When you're ready for real cross-account viewing, I'll:
- Add view-only staff SELECT policies to each data table (one migration).
- Add `context.activeProfileId` to the auth middleware, defaulting to `userId`, overridable via a header for verified staff.
- Migrate server functions one dashboard section at a time (bookings, then clients, then reports…), verifying each before moving on.
- Ship the workspace switcher dropdown and per-section read-only guards.

## Files touched in Phase 1

- `src/routes/staff-accept.$token.tsx` — replace silent sign-up with clear existing-account flow.
- `src/routes/_authenticated/dashboard.invites.tsx` — new page listing your staff memberships.
- `src/routes/_authenticated/dashboard.menu.tsx` — add "Invited clinics" link.
- `src/lib/staff.functions.ts` — new `listMyStaffMemberships` server fn (self-read via existing "Staff can read their own row" policy).
- `src/routes/_authenticated/dashboard.staff.tsx` — warn if the invited email matches the owner's login email.

No database migration needed for phase 1 — the `staff_members` table already has `user_id`, `status`, and the self-read policy.

Approve this revised plan and I'll build phase 1 now.
