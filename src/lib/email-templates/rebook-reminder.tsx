import * as React from 'react'
import { Html, Preview, Heading, Text, Button, Section } from '@react-email/components'
import { ModoShell, Head, styles, brandedButton, BodyOverride } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Props {
  patientName?: string
  clinicName?: string
  treatmentName?: string
  practitionerName?: string
  bookingUrl?: string
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
  treatmentName,
  practitionerName,
  bookingUrl = 'https://modobook.uk',
  logoUrl,
  brandColor,
  introOverride,
  closingOverride,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Time to rebook your {treatmentName || 'appointment'}</Preview>
    <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
      <Heading as="h1" style={styles.h1}>Time to rebook</Heading>
      {introOverride?.trim() ? (
        <Text style={styles.text}>{introOverride}</Text>
      ) : (
        <Text style={styles.text}>
          Hi {patientName}, we hope you've been enjoying the results
          {treatmentName ? ` from your ${treatmentName}` : ''}
          {practitionerName ? ` with ${practitionerName}` : ''}. Based on {clinicName}'s recommended interval, you're due for your next appointment — now's a great time to book it in.
        </Text>
      )}
      <Section style={styles.buttonWrap}>
        <Button href={bookingUrl} style={brandedButton(brandColor)}>Book your next appointment</Button>
      </Section>
      <Text style={styles.muted}>{closingOverride?.trim() || 'Popular slots fill quickly — securing your date early keeps you on schedule.'}</Text>
    </ModoShell>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const override = (d.subjectOverride as string | null | undefined)?.trim()
    if (override) return override
    const clinic = (d.clinicName as string) || 'MODO'
    const tx = (d.treatmentName as string | undefined)
    return tx ? `Time to rebook your ${tx} at ${clinic}` : `Time to rebook at ${clinic}`
  },
  displayName: 'Rebook reminder',
  previewData: {
    patientName: 'Alex',
    clinicName: 'MODO',
    treatmentName: 'Lip filler',
    practitionerName: 'Dr Jamie Reid',
    bookingUrl: 'https://modobook.uk/m/demo',
  },
} satisfies TemplateEntry
