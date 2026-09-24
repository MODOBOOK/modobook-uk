# Booking confirmation email redesign

## Build
- Replace the booking-confirmation email with a 560px centred, table-based clinic design using the supplied cream palette and inline email-safe styles.
- Show the clinic logo, clinic name, and optional clinic image without broken-image placeholders.
- Add the requested appointment, payment, manage-booking, Google Calendar, and Outlook Calendar content.
- Keep multi-treatment bookings as one confirmation and list each treatment separately.

## Live booking data
- Pass separate date, time, duration, location, treatment totals, paid amount, amount due, and payment state into the template.
- Generate appointment-specific Google and Outlook calendar links.
- Use the appointment manage link, falling back only to the clinic's `/m/{clinic_slug}` booking page.
- Set replies to the clinic contact email when available; otherwise omit Reply-To.

## Sending
- Send as `MODO No-Reply <noreply@modobook.uk>` from server-side code only.
- Keep credentials server-only and preserve queueing, suppression, deduplication, and retry protection.
- Connect Resend before changing the delivery provider; no key will be added to browser settings.

## Verification
- Render the supplied Example Aesthetics sample and check the HTML and plain-text versions.
- Run the focused email/template checks and verify the confirmation send payload.
- Leave reminder, cancellation, and practitioner-alert redesigns unchanged for now; they will reuse this visual system next.
