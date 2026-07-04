import * as React from 'react'
import { Html, Preview, Heading, Text, Button, Section } from '@react-email/components'
import { ModoShell, Head, styles, brandedButton } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Props {
  patientName?: string
  clinicName?: string
  treatmentName?: string
  dateTime?: string
  cancelledBy?: 'clinic' | 'patient'
  reason?: string
  rebookUrl?: string
  logoUrl?: string | null
  brandColor?: string | null
  subjectOverride?: string | null
  introOverride?: string | null
  closingOverride?: string | null
}

const Email = ({
  patientName = 'there',
  clinicName = 'MODO',
  treatmentName = 'your appointment',
  dateTime = '',
  cancelledBy = 'clinic',
  reason,
  rebookUrl,
  logoUrl,
  brandColor,
  introOverride,
  closingOverride,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {clinicName} appointment has been cancelled</Preview>
    <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
      <Heading as="h1" style={styles.h1}>Your appointment has been cancelled</Heading>
      {introOverride?.trim() ? (
        <Text style={styles.text}>{introOverride}</Text>
      ) : (
        <Text style={styles.text}>
          Hi {patientName},{' '}
          {cancelledBy === 'clinic'
            ? `we're sorry — ${clinicName} has had to cancel your ${treatmentName}${dateTime ? ` on ${dateTime}` : ''}.`
            : `this confirms your ${treatmentName}${dateTime ? ` on ${dateTime}` : ''} has been cancelled.`}
        </Text>
      )}
      {reason && (
        <Section style={{ backgroundColor: '#efe7d8', borderRadius: 12, padding: '14px 16px', margin: '4px 0 18px' }}>
          <Text style={{ ...styles.muted, margin: 0 }}><strong>Note from the clinic:</strong> {reason}</Text>
        </Section>
      )}
      {rebookUrl && (
        <Section style={styles.buttonWrap}>
          <Button href={rebookUrl} style={brandedButton(brandColor)}>Book another time</Button>
        </Section>
      )}
      <Text style={styles.muted}>{closingOverride?.trim() || 'If you have any questions, just reply to this email.'}</Text>
    </ModoShell>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const override = (d.subjectOverride as string | null | undefined)?.trim()
    if (override) return override
    return `Appointment cancelled — ${(d.clinicName as string) || 'MODO'}`
  },
  displayName: 'Booking cancellation',
  previewData: {
    patientName: 'Alex',
    clinicName: 'MODO',
    treatmentName: 'Lip filler consultation',
    dateTime: 'Fri 12 Jul 2026 · 2:30 PM',
    cancelledBy: 'clinic',
    reason: 'The practitioner is unwell — sorry for the short notice.',
    rebookUrl: 'https://modobook.uk/m/demo',
  },
} satisfies TemplateEntry
