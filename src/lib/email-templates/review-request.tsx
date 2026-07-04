import * as React from 'react'
import { Html, Preview, Heading, Text, Button, Section } from '@react-email/components'
import { ModoShell, Head, styles, brandedButton } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Props {
  patientName?: string
  clinicName?: string
  treatmentName?: string
  practitionerName?: string
  reviewUrl?: string
  logoUrl?: string | null
  brandColor?: string | null
}

const Email = ({
  patientName = 'there',
  clinicName = 'MODO',
  treatmentName,
  practitionerName,
  reviewUrl = 'https://modobook.uk',
  logoUrl,
  brandColor,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>How was your visit to {clinicName}?</Preview>
    <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
      <Heading as="h1" style={styles.h1}>How was your visit?</Heading>
      <Text style={styles.text}>
        Hi {patientName}, thanks for choosing {clinicName}
        {treatmentName ? ` for your ${treatmentName}` : ''}
        {practitionerName ? ` with ${practitionerName}` : ''}. We'd love to hear how it went — it only takes a minute.
      </Text>
      <Section style={styles.buttonWrap}>
        <Button href={reviewUrl} style={brandedButton(brandColor)}>Leave a review</Button>
      </Section>
      <Text style={styles.muted}>Your feedback helps other patients and helps us keep improving.</Text>
    </ModoShell>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => `How was your visit to ${(d.clinicName as string) || 'MODO'}?`,
  displayName: 'Review request',
  previewData: {
    patientName: 'Alex',
    clinicName: 'MODO',
    treatmentName: 'Lip filler consultation',
    practitionerName: 'Dr Jamie Reid',
    reviewUrl: 'https://modobook.uk/m/demo/reviews',
  },
} satisfies TemplateEntry
