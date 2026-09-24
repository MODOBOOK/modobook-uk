import * as React from 'react'
import { Html, Preview, Heading, Text, Button, Section } from '@react-email/components'
import { ModoShell, Head, styles, brandedButton, BodyOverride } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Props {
  patientName?: string
  clinicName?: string
  formName?: string
  dueBy?: string
  formUrl?: string
  forms?: Array<{ name: string; url: string; type?: 'medical' | 'consent' }>
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
  formName = 'a medical form',
  dueBy,
  formUrl = 'https://modobook.uk',
  forms,
  logoUrl,
  brandColor,
  introOverride,
  bodyOverride,
  closingOverride,
}: Props) => {
  const requestedForms = forms?.length ? forms : [{ name: formName, url: formUrl }]
  const multiple = requestedForms.length > 1
  return <Html lang="en" dir="ltr">
    <Head />
    <Preview>{clinicName} needs you to complete {multiple ? `${requestedForms.length} forms` : requestedForms[0]?.name}</Preview>
    <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
      <Heading as="h1" style={styles.h1}>Please complete your {multiple ? 'forms' : 'form'}</Heading>
      {introOverride?.trim() ? (
        <Text style={styles.text}>{introOverride}</Text>
      ) : (
        <Text style={styles.text}>
          Hi {patientName}, {clinicName} has sent you {multiple ? 'the following forms' : <strong>{requestedForms[0]?.name}</strong>} to complete ahead of your appointment.
        </Text>
      )}
      <BodyOverride text={bodyOverride} />
      {dueBy && (
        <Section style={{ backgroundColor: '#f5f1ea', borderRadius: 12, padding: '12px 16px', margin: '4px 0 18px' }}>
          <Text style={{ ...styles.muted, margin: 0 }}>Please complete by <strong>{dueBy}</strong>.</Text>
        </Section>
      )}
      {requestedForms.map((form, index) => (
        <Section key={`${form.url}-${index}`} style={{ ...styles.buttonWrap, margin: index === requestedForms.length - 1 ? '12px 0 18px' : '12px 0 0' }}>
          <Text style={{ ...styles.muted, color: '#2c2620', fontWeight: 700, marginBottom: '7px' }}>{form.name}</Text>
          <Button href={form.url} style={brandedButton(brandColor)}>{form.type === 'consent' ? 'Review and sign consent' : 'Complete medical form'}</Button>
        </Section>
      ))}
      <Text style={styles.muted}>{closingOverride?.trim() || 'Your answers are shared securely with your practitioner.'}</Text>
    </ModoShell>
  </Html>
}

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const override = (d.subjectOverride as string | null | undefined)?.trim()
    if (override) return override
    const clinic = (d.clinicName as string) || 'MODO'
    const forms = d.forms as Array<unknown> | undefined
    if (forms && forms.length > 1) return `Please complete your forms — ${clinic}`
    const form = (d.formName as string) || 'form'
    return `Please complete your ${form} — ${clinic}`
  },
  displayName: 'Medical form request',
  previewData: {
    patientName: 'Alex',
    clinicName: 'MODO',
    forms: [
      { name: 'Pre-treatment health questionnaire', url: 'https://modobook.uk/f/demo-token', type: 'medical' },
      { name: 'Treatment consent', url: 'https://modobook.uk/c/demo-token', type: 'consent' },
    ],
    dueBy: '10 Jul 2026',
  },
} satisfies TemplateEntry
