import * as React from 'react'
import { Body, Head, Html, Img, Link, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  patientName?: string
  clinicName?: string
  treatmentName?: string
  services?: { name: string; price?: string }[]
  date?: string
  time?: string
  duration?: string
  location?: string
  treatmentPrice?: string
  amountPaid?: string
  amountDue?: string
  paymentNote?: string | null
  manageUrl?: string
  calendarGoogleUrl?: string
  calendarAppleUrl?: string
  logoUrl?: string | null
  clinicImageUrl?: string | null
  brandColor?: string | null
  subjectOverride?: string | null
  preparationNotes?: string | null
  cancellationPolicy?: string | null
  directionsUrl?: string | null
  websiteUrl?: string | null
  instagramUrl?: string | null
}

const palette = {
  page: '#eeeae4',
  card: '#faf8f5',
  border: '#e4ddd3',
  text: '#2c2620',
  muted: '#8a8176',
}

function safeBrandColor(value?: string | null) {
  return value && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : palette.text
}

function DetailRow({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <tr>
      <td style={{ width: '108px', padding: '14px 0', borderBottom: last ? 'none' : `1px solid ${palette.border}`, color: palette.muted, fontSize: '13px', verticalAlign: 'top' }}>
        {label}
      </td>
      <td style={{ padding: '14px 0', borderBottom: last ? 'none' : `1px solid ${palette.border}`, color: palette.text, fontSize: '14px', lineHeight: '21px', verticalAlign: 'top' }}>
        {children}
      </td>
    </tr>
  )
}

const Email = ({
  patientName = 'Sarah',
  clinicName = 'Example Aesthetics',
  treatmentName = 'Consultation',
  services,
  date = 'Fri 26 Sep 2026',
  time = '10:30',
  duration = '60 minutes',
  location = 'Example Aesthetics',
  treatmentPrice = '£75.00',
  amountPaid = '£25.00',
  amountDue = '£50.00',
  paymentNote,
  manageUrl,
  calendarGoogleUrl,
  calendarAppleUrl,
  logoUrl,
  clinicImageUrl,
  brandColor,
  preparationNotes,
  cancellationPolicy,
  directionsUrl,
  websiteUrl,
  instagramUrl,
}: Props) => {
  const accent = safeBrandColor(brandColor)
  const treatments = services?.length ? services : [{ name: treatmentName }]
  const note = paymentNote?.trim() || `You have paid ${amountPaid}. The remaining balance is ${amountDue}.`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your appointment with {clinicName} is confirmed</Preview>
      <Body style={{ margin: 0, padding: '28px 12px 40px', backgroundColor: palette.page, color: palette.text, fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <table role="presentation" cellPadding="0" cellSpacing="0" width="100%" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td align="center">
                <table role="presentation" cellPadding="0" cellSpacing="0" width="560" style={{ width: '100%', maxWidth: '560px', borderCollapse: 'separate', backgroundColor: palette.card, border: `1px solid ${palette.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                  <tbody>
                    <tr>
                      <td align="center" style={{ padding: '30px 28px 25px', borderBottom: `2px solid ${accent}` }}>
                        {logoUrl ? <Img src={logoUrl} alt={`${clinicName} logo`} height="54" style={{ display: 'block', width: 'auto', height: '54px', maxWidth: '180px', margin: '0 auto 14px' }} /> : null}
                        <Text style={{ margin: 0, color: palette.text, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', lineHeight: '18px', textTransform: 'uppercase' }}>
                          {clinicName}
                        </Text>
                      </td>
                    </tr>
                    {clinicImageUrl ? (
                      <tr>
                        <td style={{ padding: 0 }}>
                          <Img src={clinicImageUrl} alt="" width="560" style={{ display: 'block', width: '100%', height: 'auto', margin: 0 }} />
                        </td>
                      </tr>
                    ) : null}
                    <tr>
                      <td style={{ padding: '36px 32px 34px' }}>
                        <Text style={{ margin: '0 0 16px', color: palette.text, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '28px', fontWeight: 400, lineHeight: '35px' }}>
                          Your appointment is confirmed
                        </Text>
                        <Text style={{ margin: '0 0 28px', color: palette.text, fontSize: '15px', lineHeight: '24px' }}>
                          Dear {patientName}, thank you for booking with us. We look forward to seeing you.
                        </Text>

                        <table role="presentation" cellPadding="0" cellSpacing="0" width="100%" style={{ width: '100%', borderCollapse: 'collapse', borderTop: `1px solid ${palette.border}`, borderBottom: `1px solid ${palette.border}`, margin: '0 0 28px' }}>
                          <tbody>
                            <DetailRow label="Treatment">
                              {treatments.map((service, index) => <React.Fragment key={`${service.name}-${index}`}>{index > 0 ? <br /> : null}{service.name}</React.Fragment>)}
                            </DetailRow>
                            <DetailRow label="When">{date}<br />{time} · {duration}</DetailRow>
                            <DetailRow label="Where" last>{location}</DetailRow>
                          </tbody>
                        </table>

                        <Text style={{ margin: '0 0 8px', color: palette.text, fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', lineHeight: '18px', textTransform: 'uppercase' }}>Payment</Text>
                        <table role="presentation" cellPadding="0" cellSpacing="0" width="100%" style={{ width: '100%', borderCollapse: 'collapse', margin: '0 0 14px' }}>
                          <tbody>
                            <DetailRow label="Treatment cost">{treatmentPrice}</DetailRow>
                            <DetailRow label="Paid so far">{amountPaid}</DetailRow>
                            <DetailRow label="Still to pay" last>{amountDue}</DetailRow>
                          </tbody>
                        </table>
                        <Text style={{ margin: '0 0 28px', color: palette.muted, fontSize: '13px', lineHeight: '21px' }}>{note}</Text>

                        {preparationNotes ? <table role="presentation" cellPadding="0" cellSpacing="0" width="100%" style={{ width: '100%', backgroundColor: '#f4f0ea', border: `1px solid ${palette.border}`, borderRadius: '4px', margin: '0 0 14px' }}><tbody><tr><td style={{ padding: '15px 16px' }}><Text style={{ margin: '0 0 4px', color: palette.text, fontSize: '13px', fontWeight: 700 }}>Before your appointment</Text><Text style={{ margin: 0, color: palette.muted, fontSize: '13px', lineHeight: '21px' }}>{preparationNotes}</Text></td></tr></tbody></table> : null}
                        {cancellationPolicy ? <table role="presentation" cellPadding="0" cellSpacing="0" width="100%" style={{ width: '100%', backgroundColor: '#f4f0ea', border: `1px solid ${palette.border}`, borderRadius: '4px', margin: '0 0 24px' }}><tbody><tr><td style={{ padding: '15px 16px' }}><Text style={{ margin: '0 0 4px', color: palette.text, fontSize: '13px', fontWeight: 700 }}>Cancellation policy</Text><Text style={{ margin: 0, color: palette.muted, fontSize: '13px', lineHeight: '21px' }}>{cancellationPolicy}</Text></td></tr></tbody></table> : null}

                        {manageUrl ? (
                          <table role="presentation" cellPadding="0" cellSpacing="0" width="100%" style={{ width: '100%', borderCollapse: 'separate' }}>
                            <tbody>
                              <tr>
                                <td align="center" {...({ bgcolor: accent } as Record<string, string>)} style={{ backgroundColor: accent, borderRadius: '4px', padding: '14px 20px' }}>
                                  <a href={manageUrl} target="_blank" style={{ display: 'block', color: palette.card, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', fontWeight: 700, lineHeight: '20px', textAlign: 'center', textDecoration: 'none' }}>
                                    <span style={{ color: palette.card }}>Manage your appointment</span>
                                  </a>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        ) : null}

                        {calendarGoogleUrl || calendarAppleUrl ? (
                          <table role="presentation" cellPadding="0" cellSpacing="0" width="100%" style={{ width: '100%', borderCollapse: 'separate', marginTop: '10px' }}>
                            <tbody>
                              <tr>
                                {calendarGoogleUrl ? <td width="50%" style={{ paddingRight: calendarAppleUrl ? '5px' : 0 }}><table role="presentation" cellPadding="0" cellSpacing="0" width="100%" style={{ width: '100%', borderCollapse: 'separate' }}><tbody><tr><td align="center" {...({ bgcolor: palette.card } as Record<string, string>)} style={{ backgroundColor: palette.card, border: `1px solid ${accent}`, borderRadius: '4px', padding: '11px 8px' }}><a href={calendarGoogleUrl} target="_blank" style={{ display: 'block', color: accent, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12px', fontWeight: 700, lineHeight: '18px', textAlign: 'center', textDecoration: 'none' }}><span style={{ color: accent }}>Add to Google Calendar</span></a></td></tr></tbody></table></td> : null}
                                {calendarAppleUrl ? <td width="50%" style={{ paddingLeft: calendarGoogleUrl ? '5px' : 0 }}><table role="presentation" cellPadding="0" cellSpacing="0" width="100%" style={{ width: '100%', borderCollapse: 'separate' }}><tbody><tr><td align="center" {...({ bgcolor: palette.card } as Record<string, string>)} style={{ backgroundColor: palette.card, border: `1px solid ${accent}`, borderRadius: '4px', padding: '11px 8px' }}><a href={calendarAppleUrl} target="_blank" style={{ display: 'block', color: accent, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '12px', fontWeight: 700, lineHeight: '18px', textAlign: 'center', textDecoration: 'none' }}><span style={{ color: accent }}>Add to Apple Calendar</span></a></td></tr></tbody></table></td> : null}
                              </tr>
                            </tbody>
                          </table>
                        ) : null}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <Text style={{ margin: '18px 0 0', color: palette.muted, fontSize: '11px', lineHeight: '17px', textAlign: 'center' }}>
                  {clinicName} · Booking via MODO
                </Text>
                {directionsUrl || websiteUrl || instagramUrl ? <Text style={{ margin: '6px 0 0', color: palette.muted, fontSize: '11px', lineHeight: '17px', textAlign: 'center' }}>{directionsUrl ? <Link href={directionsUrl} style={{ color: palette.muted, textDecoration: 'underline' }}>Directions</Link> : null}{directionsUrl && (websiteUrl || instagramUrl) ? ' · ' : ''}{websiteUrl ? <Link href={websiteUrl} style={{ color: palette.muted, textDecoration: 'underline' }}>Website</Link> : null}{websiteUrl && instagramUrl ? ' · ' : ''}{instagramUrl ? <Link href={instagramUrl} style={{ color: palette.muted, textDecoration: 'underline' }}>Instagram</Link> : null}</Text> : null}
              </td>
            </tr>
          </tbody>
        </table>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const override = (d.subjectOverride as string | null | undefined)?.trim()
    if (override) return override
    return `Appointment confirmed — ${(d.clinicName as string) || 'MODO'}`
  },
  displayName: 'Booking confirmation',
  previewData: {
    clinicName: 'Example Aesthetics',
    patientName: 'Sarah',
    treatmentName: 'Consultation',
    date: 'Fri 26 Sep 2026',
    time: '10:30',
    duration: '60 minutes',
    location: 'Example Aesthetics',
    treatmentPrice: '£75.00',
    amountPaid: '£25.00',
    amountDue: '£50.00',
    paymentNote: 'A £25.00 deposit has been taken. £50.00 remains to pay.',
    manageUrl: 'https://modobook.uk/m/example-aesthetics/manage/example',
    calendarGoogleUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE',
    calendarAppleUrl: 'https://modobook.uk/api/public/calendar?title=Consultation&date=2026-09-26&start=10%3A30&end=11%3A30&location=Example+Aesthetics',
  },
} satisfies TemplateEntry