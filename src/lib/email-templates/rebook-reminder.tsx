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
  generalReminder?: boolean
  followUp?: boolean
  clinicImageUrl?: string | null
  websiteUrl?: string | null
  instagramUrl?: string | null
  unsubscribeUrl?: string
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
  bodyOverride,
  closingOverride,
  generalReminder = false,
  followUp = false,
  clinicImageUrl,
  websiteUrl,
  instagramUrl,
  unsubscribeUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{generalReminder ? `We haven't seen you in a while` : `Time to rebook your ${treatmentName || 'appointment'}`}</Preview>
    <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor} imageUrl={clinicImageUrl} websiteUrl={websiteUrl} instagramUrl={instagramUrl} unsubscribeUrl={unsubscribeUrl}>
      <Heading as="h1" style={styles.h1}>{generalReminder ? `We haven't seen you in a while` : 'Time to rebook'}</Heading>
      {introOverride?.trim() ? (
        <Text style={styles.text}>{introOverride}</Text>
      ) : (
        generalReminder ? (
          <Text style={styles.text}>
            Hi {patientName}, {followUp ? `just a gentle reminder that we'd love to welcome you back to ${clinicName}.` : `we haven't seen you in a little while and would love to welcome you back to ${clinicName}.`} If you&rsquo;re ready for your next appointment, you can choose a time that suits you below.
          </Text>
        ) : (
          <Text style={styles.text}>
            Hi {patientName}, we hope you've been enjoying the results
            {treatmentName ? ` from your ${treatmentName}` : ''}
            {practitionerName ? ` with ${practitionerName}` : ''}. Based on {clinicName}'s recommended interval, you're due for your next appointment — now's a great time to book it in.
          </Text>
        )
      )}
      <BodyOverride text={bodyOverride} />
      <Section style={styles.buttonWrap}>
        <Button href={bookingUrl} style={brandedButton(brandColor)}>Book your next appointment</Button>
      </Section>
      <Text style={styles.muted}>{closingOverride?.trim() || (generalReminder ? `We look forward to seeing you whenever the time feels right.` : 'Popular slots fill quickly — securing your date early keeps you on schedule.')}</Text>
    </ModoShell>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const override = (d.subjectOverride as string | null | undefined)?.trim()
    if (override) return override
    const clinic = (d.clinicName as string) || 'MODO'
    if (d.generalReminder) return `We haven't seen you in a while — ${clinic}`
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
