// WhatsApp webhook endpoint (Meta Cloud API).
//
// Meta validates a webhook by sending a GET with these query params:
//   hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<random>
// We must echo hub.challenge back only when hub.verify_token matches our
// shared secret (MODO_WHATSAPP_VERIFY_TOKEN), otherwise 403.
//
// POST events (inbound messages, message status updates, errors) are
// acknowledged with 200 so Meta stops retrying. MODO sends outbound
// messages via its provider route; inbound handling can be added later.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/whatsapp/webhook')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const mode = url.searchParams.get('hub.mode')
        const token = url.searchParams.get('hub.verify_token')
        const challenge = url.searchParams.get('hub.challenge')

        const expected = process.env.MODO_WHATSAPP_VERIFY_TOKEN

        if (mode === 'subscribe' && token && expected && token === expected) {
          return new Response(challenge ?? '', { status: 200 })
        }
        return new Response('Forbidden', { status: 403 })
      },

      POST: async ({ request }) => {
        // Acknowledge immediately so Meta doesn't retry.
        // Inbound message/status payloads can be processed here later.
        try {
          const body = await request.text()
          // Lightweight log only — never echo message content to the client.
          const summary = body.slice(0, 200)
          console.log('[whatsapp-webhook] event received', summary)
        } catch {
          // ignore parse errors
        }
        return new Response('EVENT_RECEIVED', { status: 200 })
      },
    },
  },
})
