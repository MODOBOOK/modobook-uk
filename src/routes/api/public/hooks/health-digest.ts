// Cron endpoint: after the morning health checks, emails the platform admins
// a summary of open critical/warning findings — only when there is something
// worth telling them about. Also probes the live site and records a critical
// finding when modobook.uk is not answering.
import { createFileRoute } from '@tanstack/react-router'

const SITE_URL = 'https://modobook.uk'
const HEALTH_URL = `${SITE_URL}/admin/health`
const LABEL = 'system-health-digest'
const FROM = '"MODO Book" <noreply@modobook.uk>'
const SENDER_DOMAIN = 'notify.modobook.uk'

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

type Finding = {
  check_key: string
  severity: string
  title: string
  affected_count: number
  detail: string | null
  first_seen_at: string
}

const SEV_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#b91c1c', bg: '#fee2e2' },
  warning: { label: 'Warning', color: '#92400e', bg: '#fef3c7' },
  info: { label: 'Info', color: '#334155', bg: '#f1f5f9' },
}

function buildHtml(findings: Finding[], infoCount: number): string {
  const rows = findings
    .map((f) => {
      const sev = SEV_STYLE[f.severity] ?? SEV_STYLE['info']!
      return `<tr>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top">
    <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;color:${sev.color};background:${sev.bg}">${sev.label}</span>
  </td>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a">
    <strong>${esc(f.title)}</strong>
    ${f.detail ? `<div style="color:#64748b;font-size:12px;margin-top:2px">${esc(f.detail)}</div>` : ''}
  </td>
  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#334155;text-align:right;white-space:nowrap">${f.affected_count} affected</td>
</tr>`
    })
    .join('\n')

  const infoLine = infoCount > 0
    ? `<p style="margin:12px 0 0;color:#64748b;font-size:13px">Plus ${infoCount} lower-priority note${infoCount === 1 ? '' : 's'} on the health page.</p>`
    : ''

  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto">
  <h2 style="font-size:18px;color:#0f172a;margin:24px 0 4px">Modo system check</h2>
  <p style="margin:0 0 16px;color:#64748b;font-size:13px">The morning checks found ${findings.length} issue${findings.length === 1 ? '' : 's'} that need${findings.length === 1 ? 's' : ''} attention.</p>
  <table style="width:100%;border-collapse:collapse">
    ${rows}
  </table>
  ${infoLine}
  <p style="margin:20px 0 24px">
    <a href="${HEALTH_URL}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#0f172a;color:#ffffff;font-size:14px;text-decoration:none">Open system health</a>
  </p>
  <p style="margin:0;color:#94a3b8;font-size:12px">You are receiving this because you are a MODO platform admin. This check runs every morning; it only emails when something needs attention.</p>
</div>`
}

function buildText(findings: Finding[], infoCount: number): string {
  const lines = findings.map((f) => `- [${f.severity.toUpperCase()}] ${f.title} (${f.affected_count} affected)`)
  if (infoCount > 0) lines.push(`- Plus ${infoCount} lower-priority note(s) on the health page`)
  return `Modo system check\n\n${lines.join('\n')}\n\nOpen system health: ${HEALTH_URL}`
}

export const Route = createFileRoute('/api/public/hooks/health-digest')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
        const provided = request.headers.get('apikey') || request.headers.get('x-api-key')
        if (!expected || !provided || provided !== expected) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json' },
          })
        }

        try {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

          // 1. Fresh run of the daily integrity checks (bookings, payments, emails).
          await supabaseAdmin.rpc('run_health_checks')

          // 2. Site-up probe: a critical finding when modobook.uk does not answer.
          let siteOk = true
          let siteDetail = ''
          try {
            const res = await fetch(SITE_URL, { signal: AbortSignal.timeout(15000), redirect: 'follow' })
            siteOk = res.ok
            if (!res.ok) siteDetail = `The site responded with an error (HTTP ${res.status}).`
          } catch (e) {
            siteOk = false
            siteDetail = `The site did not respond: ${String((e as Error)?.message ?? e).slice(0, 200)}`
          }

          const nowIso = new Date().toISOString()
          const { data: existingSite } = await supabaseAdmin
            .from('health_findings')
            .select('id')
            .eq('check_key', 'site_down')
            .limit(1)
            .maybeSingle()

          if (siteOk) {
            if (existingSite) {
              await supabaseAdmin.from('health_findings').update({
                status: 'resolved', resolved_at: nowIso, detail: null, updated_at: nowIso,
              }).eq('id', (existingSite as { id: string }).id)
            }
          } else if (existingSite) {
            await supabaseAdmin.from('health_findings').update({
              status: 'open', resolved_at: null, severity: 'critical', detail: siteDetail,
              affected_count: 1, last_seen_at: nowIso, updated_at: nowIso,
            }).eq('id', (existingSite as { id: string }).id)
          } else {
            await supabaseAdmin.from('health_findings').insert({
              check_key: 'site_down', severity: 'critical', title: 'Live website is not responding',
              detail: siteDetail, affected_count: 1,
            })
          }

          // 3. Collect what is open. Only critical/warning issues trigger the email.
          const { data: open, error: openErr } = await supabaseAdmin
            .from('health_findings')
            .select('check_key, severity, title, affected_count, detail, first_seen_at')
            .eq('status', 'open')
          if (openErr) throw openErr

          const order: Record<string, number> = { critical: 0, warning: 1, info: 2 }
          const all = (open ?? []) as Finding[]
          all.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3))
          const needs = all.filter((f) => f.severity === 'critical' || f.severity === 'warning')
          const infoCount = all.filter((f) => f.severity === 'info').length

          if (needs.length === 0) {
            return Response.json({ ok: true, emailed: 0, open: all.length, note: 'nothing needs attention' })
          }

          const { data: recipients, error: recErr } = await supabaseAdmin.rpc('health_digest_recipients')
          if (recErr) throw recErr

          const today = nowIso.slice(0, 10)
          const subject = `Modo system check: ${needs.length} issue${needs.length === 1 ? '' : 's'} need attention (${today})`
          const html = buildHtml(needs, infoCount)
          const text = buildText(needs, infoCount)

          let emailed = 0
          const list = (recipients ?? []) as Array<{ email: string | null }>
          for (let i = 0; i < list.length; i++) {
            const to = String(list[i]?.email ?? '').trim().toLowerCase()
            if (!to) continue
            const messageId = `health-digest-${today}-${i}`

          // One digest per recipient per day.
            const { data: already } = await supabaseAdmin
              .from('email_send_log')
              .select('id')
              .eq('message_id', messageId)
              .limit(1)
              .maybeSingle()
            if (already) continue

            // The email API requires an unsubscribe token on every message.
            let unsubscribeToken = crypto.randomUUID().replace(/-/g, '')
            const { data: tokenRow } = await supabaseAdmin
              .from('email_unsubscribe_tokens')
              .select('token')
              .eq('email', to)
              .maybeSingle()
            if (tokenRow?.token) {
              unsubscribeToken = tokenRow.token
            } else {
              await supabaseAdmin
                .from('email_unsubscribe_tokens')
                .insert({ token: unsubscribeToken, email: to })
            }

            await supabaseAdmin.from('email_send_log').insert({
              message_id: messageId, template_name: LABEL, recipient_email: to, status: 'pending',
            })

            const { error: enqErr } = await supabaseAdmin.rpc('enqueue_email', {
              queue_name: 'transactional_emails',
              payload: {
                message_id: messageId,
                to,
                from: FROM,
                sender_domain: SENDER_DOMAIN,
                subject,
                html,
                text,
                purpose: 'transactional',
                label: LABEL,
                idempotency_key: messageId,
                queued_at: nowIso,
              },
            })
            if (enqErr) {
              console.error('[health-digest] enqueue failed', to, enqErr)
              await supabaseAdmin.from('email_send_log').insert({
                message_id: messageId, template_name: LABEL, recipient_email: to,
                status: 'failed', error_message: enqErr.message,
              })
              continue
            }
            emailed++
          }

          return Response.json({ ok: true, emailed, open: all.length, needs: needs.length })
        } catch (err) {
          console.error('[health-digest] error', err)
          return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
