## 1. Training tab (done in this turn)
Moved the **Training** link into the public header next to Book / About / Rewards / Reviews on `/m/$slug`. It appears only when the practitioner has published courses.

## 2. Gift cards — what I'll build

### Practitioner side (dashboard)
- New page **`/dashboard/gift-cards`**, linked in the sidebar right next to Treatments and Packages.
- Create/edit/delete gift-card products with:
  - Type: **Monetary value** (fixed £ amount) or **Treatment/Package** (buyer gifts an existing service).
  - Cover image (reusing `ImageUploader`).
  - Optional expiry in months (blank = never).
  - Active toggle.
- Sold gift-cards list: code, buyer, recipient, initial value, remaining balance, status, delivery date.

### Public buyer flow
- New public route **`/m/$slug/gift-cards`** (linked in the header next to Rewards/Training).
- Card grid → checkout form:
  - Buyer name/email, recipient name/email, personal message.
  - Delivery choice: **Send to recipient now** or **Send to me**.
  - Stripe Checkout for payment; on `payment_intent.succeeded` webhook we generate a unique code, mark the purchase active, and email the branded PDF-style gift card to whichever address was chosen.

### Redemption
- New **Promo / gift card** input on the booking checkout (`m.$slug.book-multi.tsx`, `m.$slug.book.$treatmentId.tsx`) — reuses the pattern of the existing `DiscountCodeBox`.
- Server fn `redeemGiftCard({slug, code, treatment_ids, total})`:
  - Value cards: partial redemption supported — deducts up to `remaining_amount`, leftover stays on the code.
  - Treatment/Package cards: only apply if the selected item matches; single-use.
  - Expired/redeemed codes rejected.
- On successful booking, decrement `remaining_amount` and log to `gift_card_redemptions`.

### Database (new tables, all with GRANTs + RLS)
- `gift_cards` — the product definitions per practitioner.
- `gift_card_purchases` — one row per purchase, with unique code and running balance.
- `gift_card_redemptions` — audit log linking purchase ↔ appointment ↔ amount.

### Email
- New branded template `gift-card-delivery.tsx` with clinic logo, recipient name, code, value/service, expiry, personal message.

### Out of scope for this pass
- Physical/printed cards.
- Bulk/corporate gift-card orders.
- Refunds of partially-redeemed cards (manual for now).

Shall I proceed with all of the above, or do you want to trim anything (e.g. skip the public purchase flow for now and just let practitioners issue codes manually)?