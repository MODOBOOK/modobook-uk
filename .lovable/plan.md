
# Stripe Standard Connect — Full Breakdown (Express removed)

Every practitioner connects their **own** Stripe account via OAuth. Full Stripe Dashboard + mobile app access. They own payouts, refunds, disputes, bank details. MODO is just the platform routing checkouts to them. **Express is being removed entirely.**

---

## Step 1 — You enable Standard in Stripe (2 min, one-time, manual)

I can't do this from code. In your **platform** Stripe Dashboard:

1. **Connect → Settings → Integration**
2. Under **OAuth for Standard accounts**, toggle **ON**
3. Set the **Redirect URI** to exactly:
   ```
   https://modo-book.lovable.app/api/public/stripe/oauth-callback
   ```
4. Copy the **Client ID** (`ca_XXXXXXXXXXXX`) and send it to me — I'll store it as `STRIPE_CONNECT_CLIENT_ID`
5. (Optional but recommended) Turn OFF Express onboarding in the same settings page

---

## Step 2 — Database changes

- Add `stripe_oauth_state` (text, nullable) to `profiles` — short-lived CSRF token
- Keep `stripe_connect_account_id` — Standard also returns `acct_...`
- No `stripe_account_type` needed (Standard only now)
- Existing Express account IDs in the DB: I'll leave the rows but mark them `stripe_connect_onboarding_status = 'legacy_express'` so the UI forces them to reconnect via Standard

---

## Step 3 — Three new endpoints

### A. `POST /api/public/stripe/oauth-start` — auth required
- Generates random `state`, saves to `profiles.stripe_oauth_state`
- Returns `{ url }` pointing at `https://connect.stripe.com/oauth/authorize` with `response_type=code`, `client_id`, `scope=read_write`, `state`, `redirect_uri`, prefilled `stripe_user[email]`

### B. `GET /api/public/stripe/oauth-callback` — public, verified by `state`
- Reads `?code=...&state=...`
- Looks up profile by `state` (single-use, expires 10 min)
- Exchanges code at `https://connect.stripe.com/oauth/token` using your platform secret key
- Stripe returns `{ stripe_user_id: "acct_..." }`
- Saves account id, sets `stripe_connect_onboarding_status='complete'`, clears `state`
- Redirects to `/dashboard/payments?connected=1`

### C. `POST /api/public/stripe/oauth-disconnect` — auth required
- Calls Stripe `POST /oauth/deauthorize`
- Nulls `stripe_connect_account_id`, resets status

---

## Step 4 — Payments dashboard UI

Replace the current Express card entirely with:

```text
Connect Stripe

Payments go directly to your own Stripe account. You'll see everything
in your Stripe Dashboard and mobile app — payouts, refunds, disputes.

Don't have Stripe yet? Create a free account at stripe.com first
(takes ~5 min), then click below.

[ Connect with Stripe ]  ← opens OAuth in new tab
```

After connect: show account ID, live/test mode, balance, payouts (existing UI), and a **Disconnect** button.

Legacy Express accounts get a red banner: *"Express is deprecated. Reconnect with your own Stripe account →"*

---

## Step 5 — Checkout code

`maybeCreateBookingCheckout` already does direct charges on the connected account via `Stripe-Account` header. Works identically for Standard. **Zero logic change.**

---

## Step 6 — Webhooks

Existing Connect webhook keeps working for both. Add one new event:
- `account.application.deauthorized` — fires if practitioner revokes MODO from their Stripe. Handler nulls their account ID.

---

## Step 7 — Rip out Express

- Remove Express create-account calls from `stripe.functions.ts` / `stripe.server.ts`
- Remove Express-specific UI (create Express account button, Express onboarding link handler, "paste your acct_ id" fallback)
- Keep `stripe_connect_account_id` reads — same column, Standard uses it
- Remove "Express Dashboard login" helper text

---

## What I need from you before coding

1. Confirm: full removal of Express, Standard-only
2. Enable OAuth for Standard in Stripe (Step 1)
3. Send me the `ca_...` client ID

Once I have those, I'll ship Steps 2–7 in one pass.
