# Referrals & Rewards — build plan

Your answers:
- Toggleable by practitioner: **credit £**, **points**, **friend discount** — each independent
- Amounts: practitioner sets their own (schema already supports)
- Trigger: **after friend's first paid appointment completes**
- No cap

Schema already exists (`clinic_referral_settings`, `patient_referral_codes`, `patient_referrals`, `patient_points_ledger`, `patient_credit_ledger`), so this is entirely UI + server logic.

---

## 1. Practitioner: Rewards settings page
New route `/_authenticated/dashboard/rewards` (linked from dashboard sidebar).
- Master **Enable rewards** toggle
- Three independent reward toggles + amount fields:
  - Referrer £ credit (pennies) — with "off" toggle
  - Referrer points — with "off" toggle
  - Friend's first-booking discount (pennies) — with "off" toggle
- Headline & description (shown to patients on their share page)
- Live preview card of what patients will see
- Save via `saveReferralSettings` server fn (upsert on `clinic_referral_settings`)

## 2. Patient: Rewards hub tab
New tab under `/hub` → `/_authenticated/hub/rewards`.
- Show clinic's headline/description + reward amounts
- **Their unique code + share link** (`/r/{code}`) with copy + native share
  - Auto-generate code on first visit if none exists
- **Balances** per clinic: credit £ (sum of credit ledger) and points (sum of points ledger)
- **Referral history**: pending / rewarded / rejected, with dates
- If clinic has rewards disabled → friendly "not offered yet" state

## 3. Public share landing `/r/$code`
- Look up code → resolve clinic → redirect to that clinic's booking page (`/m/{slug}`) with `?ref={code}` in URL
- Store referral code in sessionStorage so it survives the booking wizard

## 4. Booking flow: apply friend discount
- When booking page loads with `?ref=`, verify code + friend-discount is enabled
- Show "You'll get £X off your first booking, courtesy of [referrer's first name]"
- On successful booking creation: insert `patient_referrals` row (status='pending') linking the referrer, code, referred appointment/client, and snapshotting reward amounts
- Apply `friend_credit_pennies` as a discount on the appointment total (write into existing payment/discount fields on `appointments`)

## 5. Auto-payout trigger
Postgres trigger on `appointments`: when status transitions into a paid-complete state (existing status enum — I'll match your current "completed_paid" convention), for any pending `patient_referrals` row where `referred_appointment_id = NEW.id`:
- Insert into `patient_credit_ledger` (+referrer_credit_pennies) and `patient_points_ledger` (+referrer_points)
- Set `patient_referrals.status='rewarded'` and `rewarded_at=now()`
- Idempotent: only fires once per referral

## 6. Redeem credit at checkout
When a patient books at a clinic where they have credit balance > 0, offer a "Apply £X credit" checkbox that deducts up to the appointment total and writes a negative row to `patient_credit_ledger` on booking confirmation.

---

## Technical notes
- All server fns use `requireSupabaseAuth` — RLS on referral tables is already user-scoped
- Trigger runs as `SECURITY DEFINER` and is idempotent via `WHERE rewarded_at IS NULL`
- Public code lookup uses the existing `anon SELECT` policy on `patient_referral_codes`
- No new tables needed

## Suggested build order
Phase A (this turn): #1 practitioner settings + #2 patient hub + #3 share landing — gets the feature visible end-to-end.
Phase B (next turn): #4 friend-discount at booking + #5 auto-payout trigger + #6 credit redemption — the money flow.

Splitting keeps each turn reviewable. Say **"go"** to start Phase A, or tell me to reshuffle.
