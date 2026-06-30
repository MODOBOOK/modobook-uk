# Prescriber Hub

A shared space where verified prescribers and practitioners find each other and link up using a short, unique code. Practitioners join freely. Prescribers must upload their registration details and photo ID — admin approves, rejects, or asks for more info before the prescriber appears in the hub.

## What each role gets

**Practitioner** (the clinician you already have)
- Registers as today — no extra verification.
- Gets a unique 6-character **link code** (e.g. `MODO-4F7K`).
- Can paste a prescriber's code to send a link-up request.

**Prescriber** (new role)
- Signs up via a "Join as prescriber" route.
- Submits: full name, regulatory body, registration/PIN number, photo ID upload (passport or driving licence).
- Status starts **Pending**. Sees a **read-only preview** of the hub until approved.
- Once approved, gets their own unique link code and can request/accept links with practitioners.

**Link-up flow** (either side can start it)
- Enter the other party's code → request sent → recipient sees a pending request in their hub → Accept or Decline.
- Once accepted, the pair sees each other in their "My connections" list with name, professional title and contact.

## Regulatory bodies offered

UK: GMC, NMC, GPhC, GDC.
Ireland: MCRN, NMBI, PSI.
Plus a free-text **Other** option — admin verifies manually.

## Admin review

A new **Admin → Prescriber verifications** queue. Each row shows the submitted details and the ID image. Admin picks one of three actions:

1. **Approve** — prescriber becomes active, gets their link code, can be linked.
2. **Reject** — emailed with the admin's note; access stays locked.
3. **Request more info** — emailed with the admin's note; prescriber can re-upload and resubmit, status returns to Pending.

## Pages

**Public**
- `/prescriber-hub` — keep the existing marketing page, add two clear CTAs: *Join as practitioner* and *Join as prescriber*.
- `/prescriber-hub/join` — onboarding form for prescribers (registration details + ID upload). Practitioners are routed to the existing signup.

**Inside the dashboard**
- `/dashboard/hub` — the hub itself:
  - My code (copy button).
  - "Link with someone — enter their code".
  - Pending requests (incoming + outgoing).
  - My connections.
  - Read-only banner if the prescriber is still Pending or has been asked for more info.
- `/dashboard/hub/verification` — prescriber's own verification status with a "Resubmit" form when admin requests more info.

**Admin**
- `/admin/prescribers` — review queue with Approve / Reject / Request more info, plus a notes field.

## Technical notes

- **DB**
  - `prescriber_profiles` (one row per prescriber user): `user_id`, `full_name`, `regulatory_body` (enum incl. `other`), `regulatory_body_other`, `registration_number`, `id_document_path`, `status` (`pending` / `approved` / `rejected` / `more_info`), `admin_note`, `reviewed_by`, `reviewed_at`.
  - `hub_codes`: `owner_user_id`, `owner_kind` (`practitioner` / `prescriber`), `code` (unique).
  - `hub_links`: `requester_user_id`, `recipient_user_id`, `status` (`pending` / `accepted` / `declined`), timestamps; unique pair.
  - `app_role` enum extended with `prescriber`.
- **Storage**: new private bucket `prescriber-ids` with RLS so only the owning prescriber and admins can read.
- **RLS**: prescribers see only their own verification row; admins see all via `has_role(auth.uid(),'admin')`. Hub link rows visible to either party.
- **Server fns**: `submitPrescriberVerification`, `resubmitPrescriberVerification`, `adminListPrescriberSubmissions`, `adminDecidePrescriber` (approve/reject/more_info), `getMyHubCode`, `sendLinkRequest`, `respondToLinkRequest`, `listMyConnections`.
- **Routing**: prescriber pages live under the existing `_authenticated` subtree; admin review under `_authenticated/admin/`.
- **Emails**: reuse the existing transactional email path for the three admin decisions (Approved / Rejected / More info needed) and for incoming link requests.

## Out of scope for this first pass

- No prescription writing, script PDFs or pharmacy integration yet — this build only delivers verification + link-up. The hub is the foundation; the script workflow can plug in once the connection model is live.
