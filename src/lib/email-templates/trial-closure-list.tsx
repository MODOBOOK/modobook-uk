import * as React from 'react'
import { Html, Preview, Heading, Text } from '@react-email/components'
import { ModoShell, Head, styles } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Clinic {
  name: string
  email: string
  trialEnd: string
}

const Email = ({ clinics = [] }: { clinics?: Clinic[] }) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${clinics.length} account(s) not activated after 7 days`}</Preview>
    <ModoShell preview="" siteName="MODO">
      <Heading as="h1" style={styles.h1}>Accounts ready to close</Heading>
      <Text style={styles.text}>
        These clinics reached 7 days after their trial today without activating a subscription. Nothing has been
        closed — this list is for you to decide.
      </Text>
      {clinics.map((c) => (
        <Text key={c.email} style={styles.text}>
          <strong>{c.name}</strong> — {c.email} (trial ended {c.trialEnd})
        </Text>
      ))}
    </ModoShell>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const n = Array.isArray(d.clinics) ? d.clinics.length : 0
    return `${n} MODO account${n === 1 ? '' : 's'} not activated after 7 days`
  },
  displayName: 'Trial closure list (admin)',
  previewData: { clinics: [{ name: 'Example Clinic', email: 'hello@example.com', trialEnd: '10 October' }] },
} satisfies TemplateEntry
