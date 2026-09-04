import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/tmp-booking-alert-test')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const to = url.searchParams.get('to')
        if (!to) return new Response('missing to', { status: 400 })
        const { tryEnqueueAppEmail } = await import('@/lib/email/send.server')
        const res = await tryEnqueueAppEmail({
          templateName: 'new-booking-practitioner',
          recipientEmail: to,
          messageId: `new-booking-alert-test-${Date.now()}`,
          templateData: {
            clinicName: 'Aesthetics by Nurse Ryan',
            patientName: 'Alex Morgan',
            patientEmail: 'alex@example.com',
            patientPhone: '07700 900123',
            treatmentName: 'Lip filler consultation',
            locationName: 'Main studio',
            dateTime: 'Fri 12 Jul 2026 · 2:30 PM',
            paymentSummary: 'Deposit paid — £30.00',
            dashboardUrl: 'https://modobook.uk/dashboard/appointments',
          },
        })
        return new Response(JSON.stringify({ ok: true, res }), {
          headers: { 'content-type': 'application/json' },
        })
      },
    },
  },
})
