import * as React from 'react'
import { Html, Preview, Heading, Text, Button, Section } from '@react-email/components'
import { ModoShell, Head, styles, brandedButton } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Props {
  clinicName?: string
  patientName?: string
  patientEmail?: string
  patientPhone?: string
  treatmentName?: string
  practitionerName?: string
  locationName?: string
  dateTime?: string
  paymentSummary?: string
  patientNote?: string
  dashboardUrl?: string
  logoUrl?: string | null
  brandColor?: string | null
}

const row = (label: string, value?: string | null) =>
  value ? (
    <Text key={label} style={{ ...styles.muted, margin: '0 0 4px' }}>
      <strong style={{ color: '#3a332b' }}>{label}:</strong> {value}
    </Text>
  ) : null

const Email = ({
  clinicName = 'your clinic',
  patientName = 'A patient',
  patientEmail,
  patientPhone,
  treatmentName = 'a treatment',
  practitionerName,
  locationName,
  dateTime = 'an upcoming date',
  paymentSummary,
  patientNote,
  dashboardUrl,
  logoUrl,
  brandColor,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`New booking: ${patientName} — ${dateTime}`}</Preview>
    <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
      <Heading as="h1" style={styles.h1}>Congratulations! You have a new booking!</Heading>
      <Text style={styles.text}>
        {patientName} has just booked in with {clinicName}.
      </Text>
      <Section style={{ backgroundColor: '#f5f1ea', borderRadius: 12, padding: '16px 18px', margin: '8px 0 20px' }}>
        <Text style={{ ...styles.text, margin: '0 0 8px' }}><strong>{treatmentName}</strong></Text>
        {row('When', dateTime)}
        {row('Patient', patientName)}
        {row('Email', patientEmail)}
        {row('Phone', patientPhone)}
        {row('With', practitionerName)}
        {row('Location', locationName)}
        {row('Payment', paymentSummary)}
        {row('Note', patientNote)}
      </Section>
      {dashboardUrl && (
        <Section style={styles.buttonWrap}>
          <Button href={dashboardUrl} style={brandedButton(brandColor)}>View in your diary</Button>
        </Section>
      )}
    </ModoShell>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const name = (d.patientName as string) || 'A patient'
    const when = (d.dateTime as string) || ''
    return `New booking — ${name}${when ? ` · ${when}` : ''}`
  },
  displayName: 'New booking alert (to you)',
  previewData: {
    clinicName: 'MODO',
    patientName: 'Alex Morgan',
    patientEmail: 'alex@example.com',
    patientPhone: '07700 900123',
    treatmentName: 'Lip filler consultation',
    dateTime: 'Fri 12 Jul 2026 · 2:30 PM',
    locationName: 'Main studio',
    paymentSummary: 'Deposit paid — £30.00',
  },
} satisfies TemplateEntry
