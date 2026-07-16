import * as React from 'react'
import { Html, Preview, Heading, Text, Button, Section } from '@react-email/components'
import { ModoShell, Head, styles, brandedButton, BodyOverride } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Props {
  patientName?: string
  clinicName?: string
  treatmentName?: string
  practitionerName?: string
  locationName?: string
  locationAddress?: string
  dateTime?: string
  hoursBefore?: number
  manageUrl?: string
  logoUrl?: string | null
  brandColor?: string | null
  subjectOverride?: string | null
  introOverride?: string | null
  bodyOverride?: string | null
  closingOverride?: string | null
}

const Email = ({
  patientName = 'there',
  clinicName = 'MODO',
  treatmentName = 'your treatment',
  practitionerName,
  locationName,
  locationAddress,
  dateTime = 'your upcoming appointment',
  hoursBefore = 24,
  manageUrl,
  logoUrl,
  brandColor,
  introOverride,
  bodyOverride,
  closingOverride,
}: Props) => {
  const defaultIntro = `Hi ${patientName}, this is a friendly reminder about your upcoming appointment with ${clinicName}.`
  const defaultClosing =
    hoursBefore >= 24
      ? 'Please let us know as soon as possible if you need to reschedule.'
      : 'See you soon — please arrive a few minutes early.'
  const hasBody = !!bodyOverride?.trim()
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Reminder: {treatmentName} at {clinicName}</Preview>
      <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
        <Heading as="h1" style={styles.h1}>Appointment reminder</Heading>
        <Text style={styles.text}>{introOverride?.trim() || defaultIntro}</Text>
        {hasBody ? (
          <BodyOverride text={bodyOverride} />
        ) : (
          <Section style={{ backgroundColor: '#f5f1ea', borderRadius: 12, padding: '16px 18px', margin: '8px 0 20px' }}>
            <Text style={{ ...styles.text, margin: '0 0 6px' }}><strong>{treatmentName}</strong></Text>
            <Text style={{ ...styles.muted, margin: '0 0 4px' }}>{dateTime}</Text>
            {practitionerName && <Text style={{ ...styles.muted, margin: '0 0 4px' }}>With {practitionerName}</Text>}
            {locationName && <Text style={{ ...styles.muted, margin: '0 0 4px' }}>{locationName}</Text>}
            {locationAddress && <Text style={{ ...styles.muted, margin: 0 }}>{locationAddress}</Text>}
          </Section>
        )}
        {manageUrl && (
          <Section style={styles.buttonWrap}>
            <Button href={manageUrl} style={brandedButton(brandColor)}>Manage booking</Button>
          </Section>
        )}
        <Text style={styles.muted}>{closingOverride?.trim() || defaultClosing}</Text>
      </ModoShell>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const override = (d.subjectOverride as string | null | undefined)?.trim()
    if (override) return override
    const clinic = (d.clinicName as string) || 'MODO'
    const h = (d.hoursBefore as number) || 24
    return h >= 24
      ? `Reminder: your appointment with ${clinic}`
      : `See you soon — ${clinic}`
  },
  displayName: 'Appointment reminder',
  previewData: {
    patientName: 'Alex',
    clinicName: 'MODO',
    treatmentName: 'Lip filler consultation',
    practitionerName: 'Dr Jamie Reid',
    dateTime: 'Tomorrow · 2:30 PM',
    hoursBefore: 24,
    manageUrl: 'https://modobook.uk/m/demo/manage/xyz',
  },
} satisfies TemplateEntry
