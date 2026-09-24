# Complete MODO email redesign

## Goal
Give every MODO email a consistent, modern and calm aesthetics-clinic look, while keeping each message focused on its purpose. Clinic-facing emails will use the clinic’s saved branding; MODO account and service emails will use a restrained MODO version of the same system.

## Shared email system
- Create one reusable, email-safe card shell based on the approved confirmation: warm grey page, soft ivory card, hairline borders, Georgia titles, Arial body copy and a maximum width of 560px.
- Use the clinic’s logo, name and brand colour where clinic context exists. Use a clinic image only for relevant appointment and marketing messages, never for brief alerts or account/security emails.
- Standardise primary and outline buttons, stacked detail rows, notice blocks, dividers, inbox preview text, mobile spacing, accessible image text and plain-text fallbacks.
- Send as **MODO No-Reply <noreply@modobook.uk>**. Use the clinic contact email as Reply-To only when it exists.
- Keep the footer visually minimal: `Clinic name · Booking via MODO`. Marketing messages add a clear unsubscribe link in the same quiet footer style.

## Patient appointment emails
Restyle confirmations, reminders, cancellations, form and consent requests, review requests, rebooking, top-up reminders, waitlist messages, membership messages, gift cards and direct patient messages.

Where relevant, include:
- appointment treatment, date, time, duration and location;
- payment status and remaining balance;
- preparation notes for the booked treatment;
- a concise cancellation-policy summary;
- manage, complete-form, rebook or review actions;
- directions plus clinic website/Instagram links when saved;
- calendar links on appointment confirmations and reminders.

Confirmation remains the fullest version. Short requests and alerts use the same visual language without irrelevant sections or imagery.

## Clinic and staff emails
Restyle new-booking alerts, staff invitations, prescriber invoices, compliance reminders and clinic billing notices. Use compact, scannable details and one clear action. Do not include patient-facing preparation, social or cancellation content where it does not belong.

## Marketing emails
- Move campaign blocks into the shared clinic shell while preserving safe headings, paragraphs, images, dividers and buttons.
- Keep campaign imagery optional and clinic-branded.
- Use the minimal shared footer with the clinic name, `Booking via MODO`, and unsubscribe link.
- Preserve personalisation and the clinic booking link.

## Account emails
Restyle sign-up, magic link, invitation, password recovery, email change and reauthentication messages with the same typography and spacing, but MODO branding rather than an unrelated clinic identity. Keep security emails short and omit clinic imagery, social links and promotional content.

## Data and behaviour
- Reuse saved clinic logo, hero image, brand colour and public contact email.
- Wire existing treatment preparation text, cancellation policy, location/address, website and Instagram fields into only the templates where they are useful.
- Omit empty rows and missing images rather than showing placeholders or broken links.
- Preserve existing email custom wording and delivery safeguards, including deduplication, pauses, suppression and unsubscribe handling.

## Verification
- Render every registered email with representative sample data and verify required sections, links, footer, image omission and plain-text output.
- Check a clinic-branded example and a MODO account-email example at desktop and narrow email widths.
- Confirm no API key or delivery credential reaches the browser.

## Delivery dependency
Templates can be completed and verified in preview now. Actual Resend delivery remains on the current queue until the Resend connection is approved; nothing will be published without Ryan’s explicit instruction.
