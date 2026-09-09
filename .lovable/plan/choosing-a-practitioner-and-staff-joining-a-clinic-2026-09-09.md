# Choosing a practitioner, and staff joining a clinic

Two things are broken for clinics with a team, plus one tidy-up you asked for.

## 1. "Choose practitioner" with nowhere to choose

Right now the picker only appears tucked inside a location card, and only when
the clinic has manually linked each team member to that location. Clinics that
never did that linking see the "please choose a practitioner" message with no
list to pick from — exactly what your client reported.

What changes:

- The practitioner choice becomes its own clear step, shown **above** the
  treatment menu, straight after the location (or immediately, when there is
  only one location). Photos, names, job titles, big tap targets.
- If nobody has been linked to a location, we fall back to showing all the
  clinic's active team members instead of showing nothing.
- When choosing is optional, there's a clear "No preference" option.
- The treatment menu stays hidden until the choice is made when the clinic has
  set it to required — with a message that now sits under a real list.
- The old duplicate picker inside the location card is removed.

The owner still controls this exactly as today in Settings: patients must
choose, may choose, or it's picked automatically.

## 2. Times shown should belong to the chosen practitioner

Today the calendar shows the whole clinic's hours and the whole clinic's bookings
even after a patient picks someone. So a patient can pick Callie and be offered
a time that only Ryan works.

What changes: once someone is chosen, the available dates and times are built
from that person's working hours, their days off and their own bookings.
Clinic-wide hours and closures still apply to everyone. If nothing specific has
been set for that person, the clinic-wide hours are used as before, so no clinic
loses slots overnight.

## 3. Invited team member can't get in

The invite page already offers "create account & accept", but the new account is
made through the normal sign-up route, which waits for an email confirmation the
person never gets — so the sign-in immediately after fails and it looks like the
invite was rejected.

What changes: because the invite was sent to that exact address, the account is
created already confirmed on our side, then signed straight in and joined to the
clinic. Wording on the page and in the invite email makes it obvious this is
where you set your password for a brand-new account. If an account already
exists for that email, they're sent to sign in and the invite links to it.

## Technical notes

- `src/routes/m.$slug.index.tsx`: extract a `practitionersForLocation()` helper
  with an all-active fallback; new standalone practitioner section; remove the
  in-card picker; keep the `modo:practitionerId:<slug>` session storage contract
  used by both booking routes.
- `src/lib/public-booking.functions.ts`: add optional `practitionerId` to
  `getDayAvailability` / `getMonthAvailability`; filter `availability_rules`,
  `availability_overrides`, `blocked_dates`, `blocked_times` and busy
  appointments on `practitioner_id = X OR practitioner_id IS NULL`; if the
  practitioner has zero own rules, fall back to clinic-wide rules.
- `src/routes/m.$slug.book-multi.tsx` and `m.$slug.book.$treatmentId.tsx`: read
  the stored practitioner id into state, pass it into both availability queries
  and into the query keys, and filter `ctx.rules` by it client-side.
- `src/lib/staff.functions.ts`: new `createStaffAccountFromInvite({token,
  password})` — looks the invite up with the admin client, creates the auth user
  with `email_confirm: true`, links `staff_members.user_id`, marks it active;
  returns `{ email }` so the client signs in with password. Reuses the existing
  demo guard and expiry checks.
- `src/routes/staff-accept.$token.tsx`: call the new function instead of
  `supabase.auth.signUp`, keep the existing already-registered branch.

## Not included

- Per-practitioner treatment durations or prices.
- Letting patients switch practitioner mid-booking without reselecting a time.
