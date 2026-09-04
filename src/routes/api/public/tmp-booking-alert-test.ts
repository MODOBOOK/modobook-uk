import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/tmp-booking-alert-test')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('key') !== 'modo-tmp-alert') {
          return new Response('nope', { status: 401 })
        }
        const { tryEnqueueAppEmail } = await import('@/lib/email/send.server')
        const res = await tryEnqueueAppEmail({
          templateName: 'new-booking-practitioner',
          recipientEmail: url.searchParams.get('to') || '',
          messageId: `test-new-booking-alert-${Date.now()}`,
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
            brandColor: '#3F7F7C',
          },
        })
        return new Response(JSON.stringify(res), {
          headers: { 'content-type': 'application/json' },
        })
      },
    },
  },
})
