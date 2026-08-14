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
