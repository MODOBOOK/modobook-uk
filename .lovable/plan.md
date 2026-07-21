# Prescriber Hub Rebuild

Goal: turn the hub into a real clinical workflow so practitioners request Rx through MODO (not WhatsApp), and prescribers review, decide, and chat in one place. Fix the linking so a prescriber can never add another prescriber — only practitioners.

## 1. Fix the linking model

Today the "add practitioner" flow doesn't enforce roles, so a prescriber can add another prescriber. Rework it so:

- Prescriber sends an **invite by email** to a practitioner. If that email belongs to a `prescriber` role, the invite is blocked with a clear message.
- Practitioner receives an in-app notification + email with **Accept / Decline**.
- Only accepted links appear in either side's directory.
- Practitioner side also gets a "Find a prescriber" flow (invite by email) that mirrors the same accept/decline handshake.
- Existing `prescriber_referrals` / `patient_practitioner_links` stay as-is; add a new `prescriber_practitioner_links` table with `status` (pending/active/revoked), `invited_by`, `accepted_at`.

## 2. Prescriber Dashboard (new landing route)

Replace the current Hub landing with a real dashboard at `/hub` showing cards:

- **Outstanding requests** — awaiting review
- **Awaiting more info** — prescriber asked a question, waiting on practitioner
- **Expiring soon** — prescriptions expiring in next 30 days
- **Recently approved** — last 10
- **Linked practitioners** — count + shortcut to directory
- **Avg response time** — rolling 30-day average from request → first decision

Each card links into a filtered list view.

## 3. One-click Prescription Requests

New table `prescription_requests` bundling everything a prescriber needs on one screen:

- Patient snapshot (name, DOB, allergies)
- Medical history (from latest `appointment_medical_forms`)
- Consultation notes (linked `consultations.id`)
- Treatment requested (name, dose, area, batch if known)
- Clinical photos (uploaded to a new `rx-request-media` bucket)
- Consent (linked `appointment_consents.id`)
- Before/after images (optional)

Practitioner side: **"Request prescription"** button on any consultation → wizard that auto-pulls the above → picks a linked prescriber → submits.

Prescriber side: full-screen review page with:
- **Approve** (creates a `prescriptions` row, marks request `approved`)
- **Decline** (with reason)
- **Request more info** (opens chat thread, status → `awaiting_info`)
- Free-text clinical comments box

## 4. Clinical Decision Timeline

New table `prescription_request_events` — append-only audit log. Every state change, message, upload, view auto-writes an event with `actor_id`, `action`, `meta`, `created_at`.

Rendered as a vertical timeline on the request page for both sides. Exportable to PDF (reuse `patient-record-pdf.ts` styling) for governance.

## 5. Secure Clinical Chat

New tables `rx_chat_threads` (1:1 to a request) + `rx_chat_messages` with:

- Text
- Image / PDF attachments (stored in `rx-chat-media` bucket, signed URLs, RLS scoped to thread participants)
- Voice notes (recorded via `MediaRecorder` → uploaded as `audio/webm`)
- Read receipts (`read_by` jsonb, updated when the other party opens the thread)
- Realtime via `postgres_changes` subscription on `rx_chat_messages`

Every chat message also writes a matching event to the decision timeline so nothing lives outside the audit log.

## Data model summary

```text
prescriber_practitioner_links  invites + accept/decline
prescription_requests          patient, practitioner, prescriber, status, request payload
prescription_request_events    append-only audit for timeline
rx_chat_threads                one per request
rx_chat_messages               text/media/voice + read receipts
Storage: rx-request-media (private), rx-chat-media (private)
```

Status enum: `pending → awaiting_info → approved | declined | withdrawn`.

## Routes

- `/hub` — dashboard (prescriber)
- `/hub/requests` — full list with filters
- `/hub/requests/$id` — review + timeline + chat (split view)
- `/hub/directory` — linked practitioners + invite
- `/dashboard/prescribers` — practitioner side: linked prescribers + invite
- `/dashboard/consultations/$id` — add "Request prescription" button

## Rollout order

1. Migration: new tables, RLS, GRANTs, storage buckets, link-role guard.
2. Linking flow (both sides) — unblocks everything else.
3. Prescription request table + practitioner wizard from a consultation.
4. Prescriber review page (approve/decline/more info) + timeline auto-events.
5. Chat threads + realtime + voice notes.
6. Dashboard cards + avg-response metric.
7. PDF export of timeline.

## Out of scope for this pass

- Auto-sending scripts to pharmacies (still a separate manual step).
- Bulk prescriber → many practitioners invite (single-invite only for now).
- Legacy `prescriber_referrals` migration — new flow runs alongside; we can migrate later once adoption is confirmed.

Approve and I'll start with the migration + linking flow, then move through the list.
