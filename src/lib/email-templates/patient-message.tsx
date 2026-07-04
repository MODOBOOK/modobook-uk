// Patient message — a practitioner-composed email sent from Modo on the
// clinic's behalf. Renders plain-text-style body (newlines preserved) inside
// the branded MODO shell using the practitioner's logo/colour.
import * as React from 'react'
import { Head, Html, Preview, Text } from '@react-email/components'
import { ModoShell, styles } from './_modo-brand'
import type { TemplateEntry } from './registry'

export interface PatientMessageData {
  subject?: string
  body?: string
  clinicName?: string
  logoUrl?: string | null
  brandColor?: string | null
  /** Optional prefix (e.g. "COPY — sent to patient") shown above the body. */
  copyNotice?: string | null
}

export function PatientMessageEmail(data: PatientMessageData) {
  const {
    subject = '',
    body = '',
    clinicName = 'MODO',
    logoUrl,
    brandColor,
    copyNotice,
  } = data
  const paragraphs = String(body).split(/\n{2,}/)
  return (
    <Html>
      <Head />
      <Preview>{subject || `A message from ${clinicName}`}</Preview>
      <ModoShell preview={subject} siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
        {copyNotice ? (
          <Text style={{ ...styles.muted, fontStyle: 'italic', marginBottom: 12 }}>
            {copyNotice}
          </Text>
        ) : null}
        {paragraphs.map((p, i) => (
          <Text key={i} style={styles.text}>
            {p.split(/\n/).map((line, j, arr) => (
              <React.Fragment key={j}>
                {line}
                {j < arr.length - 1 ? <br /> : null}
              </React.Fragment>
            ))}
          </Text>
        ))}
      </ModoShell>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: PatientMessageEmail,
  subject: (data) => (data as PatientMessageData).subject || 'A message from your clinic',
  displayName: 'Patient message',
  previewData: {
    subject: 'Following up on your appointment',
    body: 'Hi Alex,\n\nJust wanted to check in after your visit last week.\n\nKind regards,\nSample Clinic',
    clinicName: 'Sample Clinic',
  },
}
