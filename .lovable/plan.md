# Booking confirmation sender and button correction

## Changes
- Show only the saved clinic name as the sender, while retaining the clean `noreply@notify.modobook.uk` address.
- Keep the main **Manage your appointment** button full width.
- Show **Add to Google Calendar** and **Add to Apple Calendar** side by side below it.
- Generate an Apple-compatible calendar link for real confirmations and test emails.
- Use email-safe table buttons with visible fallback colours so Outlook cannot hide them.

## Checks
- Render the confirmation in HTML and confirm all three links and button backgrounds are present.
- Send a fresh test confirmation using Aesthetics by Nurse Ryan branding after the checks pass.
- Keep all changes preview-only; do not publish.

## Technical details
- Update both email sending paths so sender display names no longer append “NO REPLY”.
- Extend the confirmation template and booking sender data from Outlook to Apple Calendar.
