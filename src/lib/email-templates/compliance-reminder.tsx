import * as React from 'react'
import { Html, Preview, Heading, Text, Button, Section } from '@react-email/components'
import { ModoShell, Head, styles, brandedButton } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Item {
  name: string
  dueOn: string
  overdue?: boolean
  kind?: string
}

interface Props {
  clinicName?: string
  items?: Item[]
  dashboardUrl?: string
  logoUrl?: string | null
  brandColor?: string | null
}

const Email = ({
  clinicName = 'your clinic',
  items = [],
  dashboardUrl = 'https://modobook.uk/dashboard/compliance',
  logoUrl,
  brandColor,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Checks and audits due at {clinicName}</Preview>
    <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
      <Heading as="h1" style={styles.h1}>Checks &amp; audits due</Heading>
      <Text style={styles.text}>
        These records are due at {clinicName} today. Completing them keeps your compliance file up
        to date and ready for inspection.
      </Text>
      {items.map((it) => (
        <Text key={`${it.name}-${it.dueOn}`} style={styles.text}>
          <strong>{it.name}</strong> — {it.overdue ? 'overdue since' : 'due'} {it.dueOn}
        </Text>
      ))}
      <Section style={styles.buttonWrap}>
        <Button href={dashboardUrl} style={brandedButton(brandColor)}>Open checks &amp; audits</Button>
      </Section>
      <Text style={styles.muted}>Every completed record is saved with the date, time and who signed it.</Text>
    </ModoShell>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const n = Array.isArray(d.items) ? d.items.length : 0
    return n === 1 ? '1 check is due today' : `${n} checks and audits are due`
  },
  displayName: 'Checks & audits reminder',
  previewData: {
    clinicName: 'MODO Clinic',
    items: [
      { name: 'Fridge temperature log', dueOn: '2026-01-08', overdue: false },
      { name: 'Infection prevention & control audit', dueOn: '2026-01-02', overdue: true },
    ],
    dashboardUrl: 'https://modobook.uk/dashboard/compliance',
  },
} satisfies TemplateEntry
