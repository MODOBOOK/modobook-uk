import * as React from 'react'
import { Html, Preview, Heading, Text, Button, Section } from '@react-email/components'
import { ModoShell, Head, styles, brandedButton } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Props {
  patientName?: string
  clinicName?: string
  treatmentName?: string
  practitionerName?: string
  locationName?: string
  locationAddress?: string
  dateTime?: string
  manageUrl?: string
  logoUrl?: string | null
  brandColor?: string | null
}

const Email = ({
  patientName = 'there',
  clinicName = 'MODO',
  treatmentName = 'your treatment',
  practitionerName,
  locationName,
  locationAddress,
  dateTime = 'your appointment',
  manageUrl,
  logoUrl,
  brandColor,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {clinicName} booking is confirmed</Preview>
    <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
      <Heading as="h1" style={styles.h1}>Your booking is confirmed</Heading>
      <Text style={styles.text}>Hi {patientName}, thanks for booking with {clinicName}.</Text>
      <Section style={{ backgroundColor: '#efe7d8', borderRadius: 12, padding: '16px 18px', margin: '8px 0 20px' }}>
        <Text style={{ ...styles.text, margin: '0 0 6px' }}><strong>{treatmentName}</strong></Text>
        <Text style={{ ...styles.muted, margin: '0 0 4px' }}>{dateTime}</Text>
        {practitionerName && <Text style={{ ...styles.muted, margin: '0 0 4px' }}>With {practitionerName}</Text>}
        {locationName && <Text style={{ ...styles.muted, margin: '0 0 4px' }}>{locationName}</Text>}
        {locationAddress && <Text style={{ ...styles.muted, margin: 0 }}>{locationAddress}</Text>}
      </Section>
      {manageUrl && (
        <Section style={styles.buttonWrap}>
          <Button href={manageUrl} style={brandedButton(brandColor)}>Manage booking</Button>
        </Section>
      )}
      <Text style={styles.muted}>If anything changes, use the link above to reschedule or cancel.</Text>
    </ModoShell>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const clinic = (d.clinicName as string) || 'MODO'
    return `Booking confirmed — ${clinic}`
  },
  displayName: 'Booking confirmation',
  previewData: {
    patientName: 'Alex',
    clinicName: 'MODO',
    treatmentName: 'Lip filler consultation',
    practitionerName: 'Dr Jamie Reid',
    locationName: 'Chelsea Studio',
    locationAddress: '12 Kings Road, London',
    dateTime: 'Fri 12 Jul 2026 · 2:30 PM',
    manageUrl: 'https://modobook.uk/m/demo/manage/xyz',
  },
} satisfies TemplateEntry
