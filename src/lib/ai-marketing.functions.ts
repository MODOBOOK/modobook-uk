// AI generation for practitioner marketing emails: either structured content
// in the simple block syntax, or standalone HTML email code.
import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'
const MODEL = 'google/gemini-3-flash-preview'

const CONTENT_PROMPT = `You write marketing emails for UK aesthetics clinics.

Return ONLY a JSON object, no markdown fences, with exactly these keys:
{"subject": string, "preheader": string, "body": string}

Rules for "body":
- Plain text, blocks separated by a blank line.
- A line starting with "# " is a heading.
- A line of the form "[BUTTON](url) Label" is a call-to-action button. Use {{booking_url}} as the url unless the user gives a real link. Use at most one button.
- Everything else is a paragraph.
- No markdown other than the above. No emojis. No HTML.

Rules for tone and content:
- Warm, professional UK English. Short sentences. Mobile-friendly length (150-250 words).
- Never invent prices, medical claims, guarantees or clinical outcomes that were not supplied.
- Available merge tags you may use: {{first_name}}, {{clinic_name}}, {{last_treatment}}, {{booking_url}}.
- Subject max 70 characters, preheader max 90 characters. Do not add an unsubscribe line; it is added automatically.`

const HTML_PROMPT = `You write HTML email code for UK aesthetics clinics.

Return ONLY a JSON object, no markdown fences, with exactly these keys:
{"subject": string, "preheader": string, "html": string}

Rules for "html":
- Build it from nested <table role="presentation"> elements with ALL styling inline. No <style> tags, no external CSS, no JavaScript, no forms, no web fonts.
- Output the body markup only: start with a <table> and do not emit <!DOCTYPE>, <html>, <head> or <body>.
- Max width 600px, centred on a soft neutral page background, white content area, generous padding, readable 15-16px body text, 1.6 line height.
- BRANDING IS MANDATORY. Use the exact brand colour supplied for the button background, headings and any rules or accents. Use the accent colour for secondary detail. Set font-family on every text element to the supplied heading font (headings) and body font (paragraphs), each with a safe fallback stack.
- When a logo URL is supplied, put that exact image at the top, centred, max-width 160px. When none is supplied, show the clinic name as a centred wordmark in the heading font and brand colour.
- Finish with a footer line in small muted text containing the clinic name.
- Use merge tags {{first_name}}, {{clinic_name}}, {{last_treatment}}, {{booking_url}} where natural, and use {{booking_url}} as the button link unless a real URL is supplied.
- Warm, professional UK English. No emojis. Never invent prices, medical claims or guarantees that were not supplied.
- Do not include an unsubscribe link; it is appended automatically.`


function stripFences(s: string) {
  return s.trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim()
}

async function callAi(system: string, user: string) {
  const apiKey = process.env.LOVABLE_API_KEY
  if (!apiKey) throw new Error('AI is not configured')
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': apiKey },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (res.status === 402) throw new Error('AI credits exhausted. Add credits in workspace settings.')
  if (res.status === 429) throw new Error('AI is busy right now. Try again in a moment.')
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`AI request failed (${res.status}): ${txt.slice(0, 200)}`)
  }
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const raw = stripFences(body.choices?.[0]?.message?.content ?? '')
  if (!raw) throw new Error('AI returned an empty response. Try again.')
  try {
    return JSON.parse(raw) as Record<string, string>
  } catch {
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) {
      try { return JSON.parse(m[0]) as Record<string, string> } catch { /* fall through */ }
    }
    throw new Error('AI returned an unexpected format. Try again.')
  }
}

export const generateMarketingEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { prompt: string; mode?: 'content' | 'html'; tone?: string }) => {
    const prompt = (i?.prompt || '').trim()
    if (!prompt) throw new Error('Tell the AI what the email should be about')
    return {
      prompt: prompt.slice(0, 2000),
      mode: i?.mode === 'html' ? ('html' as const) : ('content' as const),
      tone: (i?.tone || '').trim().slice(0, 60),
    }
  })
  .handler(async ({ data, context }) => {
    // Pull the clinic's own branding so generated emails match their look.
    const { data: prof } = await context.supabase
      .from('profiles')
      .select('id, clinic_name, full_name')
      .eq('user_id', context.userId)
      .maybeSingle()
    let theme: any = null
    if (prof?.id) {
      const { data: t } = await context.supabase
        .from('clinic_theme')
        .select('primary_color, logo_url')
        .eq('profile_id', prof.id)
        .maybeSingle()
      theme = t
    }

    const clinicName = prof?.clinic_name || prof?.full_name || 'the clinic'
    const brandLines = [
      `Clinic name: ${clinicName}`,
      theme?.primary_color ? `Brand colour: ${theme.primary_color}` : '',
      theme?.logo_url ? `Logo URL: ${theme.logo_url}` : '',
      data.tone ? `Tone: ${data.tone}` : '',
    ].filter(Boolean).join('\n')

    const out = await callAi(
      data.mode === 'html' ? HTML_PROMPT : CONTENT_PROMPT,
      `${brandLines}\n\nBrief: ${data.prompt}`,
    )

    return {
      mode: data.mode,
      subject: (out.subject || '').slice(0, 200),
      preheader: (out.preheader || '').slice(0, 200),
      body: (out.body || '').slice(0, 20000),
      html: (out.html || '').slice(0, 190000),
    }
  })
