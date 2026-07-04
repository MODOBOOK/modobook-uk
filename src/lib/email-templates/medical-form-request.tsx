import * as React from 'react'
import { Html, Preview, Heading, Text, Button, Section } from '@react-email/components'
import { ModoShell, Head, styles } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Props {
  patientName?: string
  clinicName?: string
  formName?: string
  dueBy?: string
  formUrl?: string
}

const Email = ({
  patientName = 'there',
  clinicName = 'MODO',
  formName = 'a medical form',
  dueBy,
  formUrl = 'https://modobook.uk',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{clinicName} needs you to complete {formName}</Preview>
    <ModoShell preview="" siteName={clinicName}>
      <Heading as="h1" style={styles.h1}>Please complete your form</Heading>
      <Text style={styles.text}>
        Hi {patientName}, {clinicName} has sent you <strong>{formName}</strong> to complete ahead of your appointment.
        It only takes a few minutes.
      </Text>
      {dueBy && (
        <Section style={{ backgroundColor: '#efe7d8', borderRadius: 12, padding: '12px 16px', margin: '4px 0 18px' }}>
          <Text style={{ ...styles.muted, margin: 0 }}>Please complete by <strong>{dueBy}</strong>.</Text>
        </Section>
      )}
      <Section style={styles.buttonWrap}>
        <Button href={formUrl} style={styles.button}>Open form</Button>
      </Section>
      <Text style={styles.muted}>Your answers are shared securely with your practitioner.</Text>
    </ModoShell>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const clinic = (d.clinicName as string) || 'MODO'
    const form = (d.formName as string) || 'medical form'
    return `Please complete your ${form} — ${clinic}`
  },
  displayName: 'Medical form request',
  previewData: {
    patientName: 'Alex',
    clinicName: 'MODO',
    formName: 'Pre-treatment health questionnaire',
    dueBy: '10 Jul 2026',
    formUrl: 'https://modobook.uk/f/demo-token',
  },
} satisfies TemplateEntry
