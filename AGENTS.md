<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Room-rental invoice payment choices are independent of booking mode and reuse profiles.invoice_* details; bank-only delivery never creates Stripe checkout. Why: saved invoice settings must stay consistent without changing how renters book.
 - Calendar appointment cards and all their descendants disable native text selection, touch callouts and browser dragging so long presses remain available for rescheduling.
 - Patient PDF leaflets use browser-only PDF.js rendering of all pages at container width rather than native iframe viewers, because mobile in-app browsers can crop documents and omit later pages.
- Scheduled hooks under /api/public/hooks authenticate with the x-cron-secret header checked by isAuthorizedCron (secret lives in private.cron_secret); never accept the publishable key — it is public.

- Public bookings never silently replace the patient's chosen practitioner, and "required" clinics refuse bookings with no choice (validateChosenPractitioner); the chosen practitioner travels in the booking link (?practitionerId). Why: the practitioner decides which Stripe account receives the deposit.
- Payment links tied to an appointment are created on the treating practitioner's payout account (payoutAccountForAppointment). Why: a team member on their own Stripe must receive that booking's money.
- Stripe confirmation searches clinic and retained staff accounts even without a clinic connection, using confirmationAccountIds. Why: successful practitioner-account payments must not be rejected before verification.
- Model-slot claims are released by an appointment cancellation database trigger, scoped to the still-linked appointment and clinic. Why: every cancellation path, including abandoned checkout, must reopen the slot without freeing a replacement booking.
- Public model-slot sections share modelSlotMatchesLocation before treatment eligibility checks. Why: counts and lists must use the same selected-location restriction.
- Booking duration helpers preserve explicit zero duration and enforce a positive time-grid step. Why: calendar gap checks must not impose a minimum treatment duration or let slot loops stall.
- Public booking prices are recomputed server-side (src/lib/booking-price.server.ts) from treatment/practitioner/location/model-slot/add-on/package data plus re-validated codes and credit; requestBooking and requestMultiBooking reject mismatches and charge the server value. Why: the browser must never set what a patient pays.
- Training course server functions enforce the Collective plan via assertTrainingAccess, not just the menu. Why: hiding a menu item never stops direct calls.
- Consent-form emails always go to the patient's email on file, never a caller-chosen address. Why: a caller-supplied recipient would leak signing links.
- Course option lists filter shared descriptions per option via courseOptionDescription, and new editor options start with blank descriptions. Why: editing one option must not reveal inherited copy on its siblings; existing stored wording remains intact.
- record_appointment_payment dedupes on the payments history (appointment + payment intent), never on appointments.stripe_payment_intent_id, and records amounts excluding passed-on Stripe fees. Why: the booking flow stores the intent before payment, which previously made every embedded card deposit skip recording.
