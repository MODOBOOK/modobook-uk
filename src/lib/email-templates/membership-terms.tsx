import * as React from 'react'
import { Html, Preview, Heading, Text, Section, Hr } from '@react-email/components'
import { ModoShell, Head, styles, brand } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Props {
  clinicName?: string
  planName?: string
  termsText?: string | null
  checkboxes?: string[]
  acceptedAt?: string
  logoUrl?: string | null
  brandColor?: string | null
}

const Email = ({
  clinicName = 'your clinic',
  planName = 'Membership',
  termsText,
  checkboxes = [],
  acceptedAt = '',
  logoUrl,
  brandColor,
}: Props) => {
  const accent = brandColor || brand.accent
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`Your ${planName} terms and conditions`}</Preview>
      <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
        <Text
          style={{
            ...styles.text,
            textTransform: 'uppercase' as const,
            letterSpacing: '3px',
            fontSize: 10,
            color: accent,
            margin: '0 0 6px',
            fontWeight: 600,
          }}
        >
          Terms and conditions
        </Text>
        <Heading as="h1" style={{ ...styles.h1, fontSize: 24, margin: '0 0 6px' }}>
          {planName}
        </Heading>
        <Text style={{ ...styles.text, color: brand.muted, margin: '0 0 18px' }}>
          Here is a copy of the terms you agreed to with {clinicName}
          {acceptedAt ? ` on ${acceptedAt}` : ''}.
        </Text>

        {termsText ? (
          <Section
            style={{
              backgroundColor: '#f6f5f2',
              borderRadius: 14,
              padding: '18px 18px',
              margin: '0 0 18px',
            }}
          >
            {String(termsText)
              .split('\n')
              .filter((line) => line.trim().length > 0)
              .map((line, i) => (
                <Text key={i} style={{ ...styles.text, margin: '0 0 8px', fontSize: 14 }}>
                  {line}
                </Text>
              ))}
          </Section>
        ) : null}

        {checkboxes.length ? (
          <Section style={{ margin: '0 0 18px' }}>
            <Text style={{ ...styles.text, fontWeight: 600, margin: '0 0 8px' }}>You agreed to:</Text>
            {checkboxes.map((label, i) => (
              <Text key={i} style={{ ...styles.text, margin: '0 0 6px', fontSize: 14 }}>
                ✓ {label}
              </Text>
            ))}
          </Section>
        ) : null}

        <Hr style={{ borderColor: '#e8e6e1', margin: '20px 0 14px' }} />
        <Text style={{ ...styles.text, color: brand.muted, fontSize: 12, margin: 0 }}>
          Keep this email for your records. If anything looks wrong, please contact {clinicName}.
        </Text>
      </ModoShell>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Your ${data['planName'] ?? 'membership'} terms and conditions`,
  displayName: 'Membership terms agreed',
  previewData: {
    clinicName: 'Aesthetics by Nurse Ryan',
    planName: 'Glow Club',
    termsText: 'Minimum term of 3 months.\nCredit expires 12 months after issue.',
    checkboxes: ['I agree to the cancellation policy', 'I understand payments are monthly'],
    acceptedAt: '6 September 2026, 18:30',
  },
} satisfies TemplateEntry
