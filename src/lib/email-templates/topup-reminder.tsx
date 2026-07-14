import * as React from 'react'
import { Html, Preview, Heading, Text, Button, Section } from '@react-email/components'
import { ModoShell, Head, styles, brandedButton } from './_modo-brand'
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
    <Preview>A quick top-up will keep your results looking their best</Preview>
    <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
      <Heading as="h1" style={styles.h1}>Ready for a top-up?</Heading>
      {introOverride?.trim() ? (
        <Text style={styles.text}>{introOverride}</Text>
      ) : (
        <Text style={styles.text}>
          Hi {patientName}, it's about time for a top-up
          {treatmentName ? ` on your ${treatmentName}` : ''}
          {practitionerName ? ` with ${practitionerName}` : ''}. A short refresh appointment now helps maintain your results and keeps you looking your best between full treatments.
        </Text>
      )}
      <Section style={styles.buttonWrap}>
        <Button href={bookingUrl} style={brandedButton(brandColor)}>Book a top-up</Button>
      </Section>
      <Text style={styles.muted}>{closingOverride?.trim() || 'Not quite ready? Reply to this email and we\u2019ll help you find a time that suits.'}</Text>
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
    return tx ? `Time for a ${tx} top-up at ${clinic}` : `Time for a top-up at ${clinic}`
  },
  displayName: 'Top-up reminder',
  previewData: {
    patientName: 'Alex',
    clinicName: 'MODO',
    treatmentName: 'Lip filler',
    practitionerName: 'Dr Jamie Reid',
    bookingUrl: 'https://modobook.uk/m/demo',
  },
} satisfies TemplateEntry
