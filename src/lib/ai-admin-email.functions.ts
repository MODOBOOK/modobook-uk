// AI generation for platform admin broadcasts: either structured content in the
// simple block syntax, or standalone HTML email code — MODO branded.
import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'
const MODEL = 'google/gemini-3-flash-preview'

const BRAND = `Brand: MODO Book — the booking and clinic management platform for UK aesthetics practitioners.
Brand colour: #B07D4F (warm bronze). Accent colour: #8A6A4B. Page background: soft warm sand (#F7F3EE).
Heading font: Syne, with a safe fallback stack. Body font: Plus Jakarta Sans, with a safe fallback stack.
Website: https://modobook.uk
Audience: aesthetics practitioners and clinic owners (not patients).`

const CONTENT_PROMPT = `You write platform update and announcement emails for MODO Book.

Return ONLY a JSON object, no markdown fences, with exactly these keys:
{"subject": string, "preheader": string, "body": string}

Rules for "body":
- Plain text, blocks separated by a blank line.
- A line starting with "# " is a heading.
- A line of the form "[BUTTON](url) Label" is a call-to-action button. Use https://modobook.uk unless a real link is supplied. Use at most one button.
- Everything else is a paragraph.
- No markdown other than the above. No emojis. No HTML.

Tone and content:
- Warm, clear, professional UK English. Short sentences. Mobile-friendly length (150-250 words).
- Never invent prices, dates, features or guarantees that were not supplied.
- You may use the merge tag {{first_name}}.
- Subject max 70 characters, preheader max 90 characters. Do not add an unsubscribe line; it is added automatically.`

const HTML_PROMPT = `You write HTML email code for MODO Book, sent from the platform to practitioners.

Return ONLY a JSON object, no markdown fences, with exactly these keys:
{"subject": string, "preheader": string, "html": string}

Rules for "html":
- Build it from nested <table role="presentation"> elements with ALL styling inline. No <style> tags, no external CSS, no JavaScript, no forms, no web fonts.
- Output the body markup only: start with a <table> and do not emit <!DOCTYPE>, <html>, <head> or <body>.
- Max width 600px, centred on the soft warm sand page background, white content area, generous padding, readable 15-16px body text, 1.6 line height.
- BRANDING IS MANDATORY. Use the MODO brand colour for buttons, headings and accents, and set font-family on every text element using the supplied heading/body fonts with safe fallbacks.
- Show "MODO Book" as a centred wordmark in the heading font and brand colour at the top.
- Finish with a small muted footer line containing MODO Book and https://modobook.uk.
- You may use the merge tag {{first_name}}. Use https://modobook.uk as the button link unless a real URL is supplied.
- Warm, professional UK English. No emojis. Never invent prices, dates or guarantees that were not supplied.
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

export const generateAdminEmail = createServerFn({ method: 'POST' })
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
    const { data: isAdmin, error } = await context.supabase.rpc('has_role', {
      _user_id: context.userId,
      _role: 'admin',
    })
    if (error) throw error
    if (!isAdmin) throw new Error('Forbidden')

    const out = await callAi(
      data.mode === 'html' ? HTML_PROMPT : CONTENT_PROMPT,
      `${BRAND}${data.tone ? `\nTone: ${data.tone}` : ''}\n\nBrief: ${data.prompt}`,
    )

    let html = (out.html || '').trim()
    if (html) {
      html = html.replace(/<!DOCTYPE[^>]*>/gi, '')
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      if (bodyMatch) html = bodyMatch[1]
      html = html
        .replace(/<\/?(html|head|body)[^>]*>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .trim()
    }

    if (data.mode === 'html' && !html) {
      throw new Error('AI did not return any email code. Try again with a bit more detail.')
    }

    return {
      mode: data.mode,
      subject: (out.subject || '').slice(0, 200),
      preheader: (out.preheader || '').slice(0, 200),
      body: (out.body || '').slice(0, 20000),
      html: html.slice(0, 190000),
    }
  })
