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

function buildHtml(findings: Finding[], infoCount: number, clinicWatch: string[]): string {
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

  const watchSection = clinicWatch.length > 0
    ? `<h3 style="font-size:15px;color:#0f172a;margin:24px 0 6px">Clinic watch</h3>
  <p style="margin:0 0 8px;color:#64748b;font-size:12px">Privacy-safe counts only — no client details.</p>
  <ul style="margin:0;padding-left:18px;color:#334155;font-size:13px;line-height:1.6">
    ${clinicWatch.map((w) => `<li>${esc(w)}</li>`).join('\n')}
  </ul>`
    : ''

  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto">
  <h2 style="font-size:18px;color:#0f172a;margin:24px 0 4px">Modo system check</h2>
  <p style="margin:0 0 16px;color:#64748b;font-size:13px">The morning checks found ${findings.length} issue${findings.length === 1 ? '' : 's'} that need${findings.length === 1 ? 's' : ''} attention.</p>
  <table style="width:100%;border-collapse:collapse">
    ${rows}
  </table>
  ${infoLine}
  ${watchSection}
  <p style="margin:20px 0 24px">
    <a href="${HEALTH_URL}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#0f172a;color:#ffffff;font-size:14px;text-decoration:none">Open system health</a>
  </p>
  <p style="margin:0;color:#94a3b8;font-size:12px">You are receiving this because you are a MODO platform admin. This check runs every morning; it only emails when something needs attention.</p>
</div>`
}

function buildText(findings: Finding[], infoCount: number, clinicWatch: string[]): string {
  const lines = findings.map((f) => `- [${f.severity.toUpperCase()}] ${f.title} (${f.affected_count} affected)`)
  if (infoCount > 0) lines.push(`- Plus ${infoCount} lower-priority note(s) on the health page`)
  if (clinicWatch.length > 0) {
    lines.push('', 'Clinic watch (privacy-safe counts only):')
    for (const w of clinicWatch) lines.push(`- ${w}`)
  }
  return `Modo system check\n\n${lines.join('\n')}\n\nOpen system health: ${HEALTH_URL}`
}

// GDPR-safe clinic watch: per-clinic counts only, no client personal data.
// Flags clinics that have gone quiet or have upcoming bookings with no price.
async function computeClinicWatch(supabaseAdmin: any): Promise<string[]> {
  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const iso = (t: number) => new Date(t).toISOString()

  const [profilesRes, bookingsRes, upcomingRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, clinic_name').limit(500),
    supabaseAdmin.from('appointments').select('profile_id, created_at')
      .gte('created_at', iso(now - 30 * day)).limit(2000),
    supabaseAdmin.from('appointments').select('profile_id, status, total_amount')
      .gte('start_time', iso(now)).lte('start_time', iso(now + 60 * day)).limit(2000),
  ])

  const names = new Map<string, string>(
    ((profilesRes.data ?? []) as any[]).map((p) => [p.id, p.clinic_name || 'Unnamed clinic']),
  )
  const lastBooking = new Map<string, number>()
  for (const b of (bookingsRes.data ?? []) as any[]) {
    const t = new Date(b.created_at).getTime()
    if (t > (lastBooking.get(b.profile_id) ?? 0)) lastBooking.set(b.profile_id, t)
  }
  const noPrice = new Map<string, number>()
  for (const b of (upcomingRes.data ?? []) as any[]) {
    if (b.status === 'cancelled') continue
    const amount = parseFloat(String(b.total_amount ?? '').replace(/[^0-9.-]/g, '')) || 0
    if (!amount) noPrice.set(b.profile_id, (noPrice.get(b.profile_id) ?? 0) + 1)
  }

  const quiet: string[] = []
  for (const [pid, t] of lastBooking) {
    if (now - t >= 14 * day && names.has(pid)) quiet.push(names.get(pid)!)
  }
  const priceless: string[] = []
  for (const [pid, n] of noPrice) {
    if (n >= 3 && names.has(pid)) priceless.push(`${names.get(pid)} (${n})`)
  }

  const lines: string[] = []
  if (quiet.length > 0) lines.push(`${quiet.length} clinic${quiet.length === 1 ? ' has' : 's have'} had no new bookings for 2+ weeks: ${quiet.slice(0, 8).join(', ')}${quiet.length > 8 ? ` and ${quiet.length - 8} more` : ''}`)
  if (priceless.length > 0) lines.push(`${priceless.length} clinic${priceless.length === 1 ? ' has' : 's have'} 3+ upcoming bookings with no price set: ${priceless.slice(0, 8).join(', ')}${priceless.length > 8 ? ` and ${priceless.length - 8} more` : ''}`)
  return lines
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
            // Unique key per run: if a previous run's send failed, the email
            // API refuses the same idempotency key forever, so a fresh key is
            // the only way a retry can succeed.
            const messageId = `health-digest-${today}-${i}-${crypto.randomUUID().slice(0, 8)}`

            // One successfully sent digest per recipient per day.
            const { data: already } = await supabaseAdmin
              .from('email_send_log')
              .select('id')
              .eq('template_name', LABEL)
              .eq('recipient_email', to)
              .eq('status', 'sent')
              .gte('created_at', `${today}T00:00:00Z`)
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
                unsubscribe_token: unsubscribeToken,
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
