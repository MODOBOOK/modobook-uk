// Ready-made MODO-branded admin broadcasts. Pure inline-styled, table-based
// HTML so it renders identically across email clients. Used as a full-email
// block in the admin broadcast composer (editable before sending).

export const MODO_LOGO_EMAIL_URL =
  'https://modobook.uk/__l5e/assets-v1/19db634a-aaa8-4d5a-89a0-52966941083c/modo-logo.png'

const ink = '#3a3530'
const muted = '#7a7268'
const page = '#faf7f2'
const border = '#ece6db'
const soft = '#f4efe7'
const accent = '#8b7355'

type Feature = { icon: string; title: string; body: string }

const FEATURES: Feature[] = [
  {
    icon: '📅',
    title: 'Upcoming appointments hub',
    body: 'A single page for everything coming up, with an AI brief per patient — forms completed, anything missing, allergies and concerns raised.',
  },
  {
    icon: '🧩',
    title: 'Packages & build your own',
    body: 'Bundle multiple sessions of any treatment, or let patients build their own package from options you choose — with your pricing and discounts applied automatically.',
  },
  {
    icon: '🚪',
    title: 'Room rental',
    body: 'Your own rental link, pooled availability, automatic room allocation and branded invoices that can send themselves after every booking.',
  },
  {
    icon: '🤝',
    title: 'Associates & clinic oversight',
    body: 'Host self-employed practitioners under your clinic, with full record oversight, document tracking and supervision logs.',
  },
  {
    icon: '📈',
    title: 'Clearer plan & billing',
    body: 'Your plan price now updates from what you actually use — extra locations or practitioners are quoted up front and charged from your next cycle.',
  },
]

function featureRow(f: Feature) {
  return `
        <tr>
          <td style="padding:0 0 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="46" valign="top" style="width:46px;padding-right:14px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" valign="middle" style="width:44px;height:44px;background-color:${soft};border-radius:22px;font-size:19px;line-height:44px;">${f.icon}</td>
                    </tr>
                  </table>
                </td>
                <td valign="top">
                  <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${ink};line-height:1.4;">${f.title}</p>
                  <p style="margin:0;font-size:14px;color:${muted};line-height:1.65;">${f.body}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
}

export const PLATFORM_UPDATES_SUBJECT = "What's coming to MODO"

export const PLATFORM_REPLY_TO = 'info@modobook.uk'
export const PLATFORM_WHATSAPP_NUMBER = '+44 7385 790119'
export const PLATFORM_WHATSAPP_LINK = `https://wa.me/${PLATFORM_WHATSAPP_NUMBER.replace(/\D/g, '')}`

export const PLATFORM_UPDATES_HTML = `<div style="background-color:${page};margin:0;padding:28px 12px 40px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;">
    <tr>
      <td align="center" style="background-color:#f0ebe3;border-radius:14px;padding:34px 24px;">
        <img src="${MODO_LOGO_EMAIL_URL}" alt="MODO" height="64" style="height:64px;width:auto;display:block;border:0;" />
      </td>
    </tr>
    <tr><td style="height:20px;line-height:20px;">&nbsp;</td></tr>
    <tr>
      <td style="background-color:#ffffff;border:1px solid ${border};border-radius:14px;padding:36px 32px;">
        <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${accent};">Product update</p>
        <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:400;color:${ink};line-height:1.25;">What&rsquo;s coming to MODO</h1>
        <p style="margin:0 0 24px;font-size:15px;color:${ink};line-height:1.65;">Hi {{first_name}},</p>
        <p style="margin:0 0 28px;font-size:15px;color:${ink};line-height:1.65;">We&rsquo;ve been building quietly in the background. Here&rsquo;s what&rsquo;s landing in your account over the coming weeks &mdash; all designed to save you admin time and keep everything in one place.</p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${FEATURES.map(featureRow).join('')}
        </table>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="center" style="padding:10px 0 6px;">
              <a href="https://modobook.uk/dashboard" style="display:inline-block;background-color:${ink};color:${page};font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;border-radius:999px;padding:14px 28px;text-decoration:none;">Open your dashboard</a>
            </td>
          </tr>
        </table>

        <hr style="border:none;border-top:1px solid ${border};margin:26px 0 16px;" />

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="background-color:${soft};border-radius:12px;padding:18px 20px;">
              <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${ink};">Questions or ideas?</p>
              <p style="margin:0 0 12px;font-size:13px;color:${muted};line-height:1.6;">Reply to this email or message us on WhatsApp &mdash; it goes straight to the MODO team.</p>
              <a href="${PLATFORM_WHATSAPP_LINK}" style="display:inline-block;background-color:#ffffff;border:1px solid ${border};border-radius:999px;padding:10px 20px;font-size:13px;font-weight:600;color:${ink};text-decoration:none;">Chat on WhatsApp</a>
              <p style="margin:10px 0 0;font-size:12px;color:${muted};">${PLATFORM_WHATSAPP_NUMBER}</p>
            </td>
          </tr>
        </table>

        <p style="margin:16px 0 0;font-size:13px;color:${muted};">&mdash; The MODO team</p>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:18px 0 0;font-size:11px;color:${muted};line-height:1.6;">Sent by MODO Book.</td>
    </tr>
  </table>
</div>`

/* ------------------------------------------------------------------ */
/* MODO-branded practitioner announcements                             */
/* ------------------------------------------------------------------ */

/** Hosted MODO imagery used as the header background band. */
export const MODO_HERO_EMAIL_URL =
  'https://modobook.uk/__l5e/assets-v1/cbdd1cf0-0a2b-439d-a5ff-dea6232ab671/modo-consultation-hero.jpeg'

type Item = { icon: string; title: string; body: string }

function itemRow(f: Item) {
  return `
        <tr>
          <td style="padding:0 0 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="46" valign="top" style="width:46px;padding-right:14px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" valign="middle" style="width:44px;height:44px;background-color:${soft};border-radius:22px;font-size:19px;line-height:44px;">${f.icon}</td>
                    </tr>
                  </table>
                </td>
                <td valign="top">
                  <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${ink};line-height:1.4;">${f.title}</p>
                  <p style="margin:0;font-size:14px;color:${muted};line-height:1.65;">${f.body}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
}

/** Shared MODO shell: hero image band + logo card + white content card. */
function modoAnnouncement(opts: {
  eyebrow: string
  title: string
  intro: string
  items: Item[]
  ctaText: string
  ctaUrl: string
  outro?: string
}) {
  return `<div style="background-color:${page};margin:0;padding:28px 12px 40px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;">
    <tr>
      <td style="padding:0;">
        <img src="${MODO_HERO_EMAIL_URL}" alt="" width="560" style="width:100%;max-width:560px;height:auto;display:block;border:0;border-radius:14px 14px 0 0;" />
      </td>
    </tr>
    <tr>
      <td align="center" style="background-color:#f0ebe3;border-radius:0 0 14px 14px;padding:26px 24px;">
        <img src="${MODO_LOGO_EMAIL_URL}" alt="MODO" height="56" style="height:56px;width:auto;display:block;border:0;" />
      </td>
    </tr>
    <tr><td style="height:20px;line-height:20px;">&nbsp;</td></tr>
    <tr>
      <td style="background-color:#ffffff;border:1px solid ${border};border-radius:14px;padding:36px 32px;">
        <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${accent};">${opts.eyebrow}</p>
        <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:400;color:${ink};line-height:1.25;">${opts.title}</h1>
        <p style="margin:0 0 20px;font-size:15px;color:${ink};line-height:1.65;">Hi {{first_name}},</p>
        <p style="margin:0 0 28px;font-size:15px;color:${ink};line-height:1.65;">${opts.intro}</p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${opts.items.map(itemRow).join('')}
        </table>

        ${opts.outro ? `<p style="margin:0 0 22px;font-size:15px;color:${ink};line-height:1.65;">${opts.outro}</p>` : ''}

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td align="center" style="padding:10px 0 6px;">
              <a href="${opts.ctaUrl}" style="display:inline-block;background-color:${ink};color:${page};font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;border-radius:999px;padding:14px 28px;text-decoration:none;">${opts.ctaText}</a>
            </td>
          </tr>
        </table>

        <hr style="border:none;border-top:1px solid ${border};margin:26px 0 16px;" />

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="background-color:${soft};border-radius:12px;padding:18px 20px;">
              <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${ink};">Questions or ideas?</p>
              <p style="margin:0 0 12px;font-size:13px;color:${muted};line-height:1.6;">Reply to this email or message us on WhatsApp &mdash; it goes straight to the MODO team.</p>
              <a href="${PLATFORM_WHATSAPP_LINK}" style="display:inline-block;background-color:#ffffff;border:1px solid ${border};border-radius:999px;padding:10px 20px;font-size:13px;font-weight:600;color:${ink};text-decoration:none;">Chat on WhatsApp</a>
              <p style="margin:10px 0 0;font-size:12px;color:${muted};">${PLATFORM_WHATSAPP_NUMBER}</p>
            </td>
          </tr>
        </table>

        <p style="margin:16px 0 0;font-size:13px;color:${muted};">&mdash; The MODO team</p>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:18px 0 0;font-size:11px;color:${muted};line-height:1.6;">Sent by MODO Book.</td>
    </tr>
  </table>
</div>`
}

export const PLATFORM_LIVE_TONIGHT_SUBJECT = "It's live: new features now in your MODO account"

export const PLATFORM_LIVE_TONIGHT_HTML = modoAnnouncement({
  eyebrow: 'Now live',
  title: 'New in your account tonight',
  intro:
    'We&rsquo;ve just switched on a set of features for every MODO account &mdash; no setup fee, nothing to install. They&rsquo;re in your dashboard right now.',
  items: [
    {
      icon: '🧠',
      title: 'Brief me &mdash; AI patient briefs',
      body: 'One tap before a patient arrives: forms completed, anything missing, allergies, previous treatments and concerns raised, summarised in seconds.',
    },
    {
      icon: '🚪',
      title: 'Room rental',
      body: 'Your own rental booking link, pooled availability, automatic room allocation with no double-bookings, and a live &ldquo;who&rsquo;s in&rdquo; day view.',
    },
    {
      icon: '🎓',
      title: 'Training pages',
      body: 'A dedicated training link for your academy, with fixed course dates or bookings straight from your own availability, images, course info and downloadable handouts.',
    },
    {
      icon: '🧩',
      title: 'Build your own package',
      body: 'Patients pick the treatments and number of sessions themselves from the options you allow &mdash; your pricing and discounts applied automatically.',
    },
    {
      icon: '📅',
      title: 'New calendar &amp; rota tools',
      body: 'Start and end rotas with proper date ranges, open or block time for one location or several, reorder locations and mark any of them &ldquo;coming soon&rdquo;.',
    },
    {
      icon: '💳',
      title: 'Gift cards, packages &amp; split payments',
      body: 'Sell gift cards from your booking page, bundle multiple sessions of any treatment, and let patients split a payment across instalments.',
    },
  ],
  ctaText: 'Open your dashboard',
  ctaUrl: 'https://modobook.uk/dashboard',
  outro:
    'Everything above is already enabled &mdash; you&rsquo;ll also see a &ldquo;What&rsquo;s new&rdquo; card on your dashboard which you can dismiss once you&rsquo;ve had a look.',
})

export const PLATFORM_COMING_NEXT_SUBJECT = "What's coming next to MODO"

export const PLATFORM_COMING_NEXT_HTML = modoAnnouncement({
  eyebrow: 'Coming next',
  title: 'What we&rsquo;re building next',
  intro:
    'Here&rsquo;s what&rsquo;s in the workshop right now. We&rsquo;ll turn these on for your account as soon as they&rsquo;re ready &mdash; no action needed from you.',
  items: [
    {
      icon: '💬',
      title: 'SMS reminders &amp; confirmations',
      body: 'Booking confirmations, reminders and review requests sent by text as well as email, with your own wording and full control over what goes out on which channel.',
    },
    {
      icon: '🤝',
      title: 'Associates',
      body: 'Host self-employed practitioners under your clinic with full record oversight, document tracking and supervision logs. An optional add-on when it launches.',
    },
    {
      icon: '📣',
      title: 'SMS marketing &amp; free-typed messages',
      body: 'Send a one-off text to a patient or a campaign to an opted-in list, straight from the same place as your email marketing.',
    },
    {
      icon: '👥',
      title: 'Staff updates',
      body: 'Richer staff management &mdash; permissions, shift notes and internal updates shared across your team.',
    },
  ],
  ctaText: 'See your dashboard',
  ctaUrl: 'https://modobook.uk/dashboard',
  outro:
    'If there&rsquo;s something you&rsquo;d like prioritised, tell us &mdash; the roadmap is shaped by what clinics ask for most.',
})
