import * as React from 'react'
import { Html, Preview, Heading, Text, Button, Section } from '@react-email/components'
import { ModoShell, Head, styles, brandedButton, BodyOverride, DetailRow, Notice } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Props {
  patientName?: string
  clinicName?: string
  treatmentName?: string
  practitionerName?: string
  locationName?: string
  locationAddress?: string
  duration?: string
  preparationNotes?: string | null
  cancellationPolicy?: string | null
  directionsUrl?: string | null
  calendarGoogleUrl?: string | null
  calendarOutlookUrl?: string | null
  clinicImageUrl?: string | null
  websiteUrl?: string | null
  instagramUrl?: string | null
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
  duration,
  preparationNotes,
  cancellationPolicy,
  directionsUrl,
  calendarGoogleUrl,
  calendarOutlookUrl,
  clinicImageUrl,
  websiteUrl,
  instagramUrl,
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
      <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor} imageUrl={clinicImageUrl} websiteUrl={websiteUrl} instagramUrl={instagramUrl} directionsUrl={directionsUrl}>
        <Heading as="h1" style={styles.h1}>Appointment reminder</Heading>
        <Text style={styles.text}>{introOverride?.trim() || defaultIntro}</Text>
        {hasBody ? (
          <BodyOverride text={bodyOverride} />
        ) : (
          <table role="presentation" cellPadding="0" cellSpacing="0" width="100%" style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #e4ddd3', borderBottom: '1px solid #e4ddd3', margin: '8px 0 22px' }}><tbody>
            <DetailRow label="Treatment">{treatmentName}</DetailRow>
            <DetailRow label="When">{dateTime}{duration ? <><br />{duration}</> : null}</DetailRow>
            {practitionerName ? <DetailRow label="With">{practitionerName}</DetailRow> : null}
            <DetailRow label="Where" last>{[locationName, locationAddress].filter(Boolean).join(', ')}</DetailRow>
          </tbody></table>
        )}
        {preparationNotes ? <Notice title="Before your appointment">{preparationNotes}</Notice> : null}
        {cancellationPolicy ? <Notice title="Cancellation policy">{cancellationPolicy}</Notice> : null}
        {manageUrl && (
          <Section style={styles.buttonWrap}>
            <Button href={manageUrl} style={brandedButton(brandColor)}>Manage booking</Button>
          </Section>
        )}
        {calendarGoogleUrl || calendarOutlookUrl ? <Text style={{ ...styles.muted, textAlign: 'center' }}>{calendarGoogleUrl ? <a href={calendarGoogleUrl} style={styles.link}>Google Calendar</a> : null}{calendarGoogleUrl && calendarOutlookUrl ? ' · ' : ''}{calendarOutlookUrl ? <a href={calendarOutlookUrl} style={styles.link}>Outlook</a> : null}</Text> : null}
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
