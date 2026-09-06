import * as React from 'react'
import { Html, Preview, Heading, Text, Section, Button, Hr } from '@react-email/components'
import { ModoShell, Head, styles, brand } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Props {
  recipientName?: string
  clinicName?: string
  planName?: string
  priceText?: string
  intervalLabel?: string
  creditText?: string | null
  discountPercent?: number | null
  scheduleText?: string | null
  perks?: string[]
  includedTreatments?: Array<{ name: string; quantity: number }>
  personalMessage?: string | null
  joinUrl?: string
  logoUrl?: string | null
  brandColor?: string | null
}

const Email = ({
  recipientName = 'there',
  clinicName = 'your clinic',
  planName = 'Membership',
  priceText = '£50.00',
  intervalLabel = 'month',
  creditText,
  discountPercent,
  scheduleText,
  perks = [],
  includedTreatments = [],
  personalMessage,
  joinUrl = 'https://modobook.uk',
  logoUrl,
  brandColor,
}: Props) => {
  const accent = brandColor || brand.accent
  const firstName = (recipientName || 'there').split(' ')[0]

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`You've been invited to join ${planName} at ${clinicName}`}</Preview>
      <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
        <Text
          style={{
            ...styles.text,
            textAlign: 'center' as const,
            textTransform: 'uppercase' as const,
            letterSpacing: '3px',
            fontSize: 10,
            color: accent,
            margin: '0 0 6px',
            fontWeight: 600,
          }}
        >
          Membership invitation
        </Text>
        <Heading as="h1" style={{ ...styles.h1, textAlign: 'center' as const, fontSize: 26, margin: '0 0 6px' }}>
          {planName}
        </Heading>
        <Text style={{ ...styles.text, textAlign: 'center' as const, color: brand.muted, margin: '0 0 22px' }}>
          Hi {firstName}, {clinicName} has invited you to join this membership.
        </Text>

        <Section
          style={{
            backgroundColor: accent,
            borderRadius: 16,
            padding: '26px 22px',
            margin: '0 0 20px',
            textAlign: 'center' as const,
            color: '#fff',
          }}
        >
          <Heading as="h2" style={{ margin: 0, fontSize: 38, fontWeight: 400, color: '#fff' }}>
            {priceText}
          </Heading>
          <Text style={{ margin: '4px 0 0', fontSize: 13, color: '#fff', opacity: 0.9 }}>per {intervalLabel}</Text>
          {creditText ? (
            <Text style={{ margin: '12px 0 0', fontSize: 14, color: '#fff' }}>
              {creditText} of treatment credit every {intervalLabel}
            </Text>
          ) : null}
          {discountPercent ? (
            <Text style={{ margin: '6px 0 0', fontSize: 14, color: '#fff' }}>
              {discountPercent}% off your bookings
            </Text>
          ) : null}
          {scheduleText ? (
            <Text style={{ margin: '6px 0 0', fontSize: 14, color: '#fff', opacity: 0.9 }}>{scheduleText}</Text>
          ) : null}
        </Section>

        {personalMessage ? (
          <Text style={{ ...styles.text, fontStyle: 'italic' as const, margin: '0 0 18px' }}>
            “{personalMessage}”
          </Text>
        ) : null}

        {includedTreatments.length > 0 ? (
          <Section style={{ margin: '0 0 18px' }}>
            <Text style={{ ...styles.text, fontWeight: 600, margin: '0 0 8px' }}>Treatments included</Text>
            {includedTreatments.map((t, i) => (
              <Text key={i} style={{ ...styles.text, margin: '0 0 4px' }}>
                {t.quantity}× {t.name}
              </Text>
            ))}
          </Section>
        ) : null}

        {perks.length > 0 ? (
          <Section style={{ margin: '0 0 18px' }}>
            {perks.map((p, i) => (
              <Text key={i} style={{ ...styles.text, margin: '0 0 4px' }}>
                • {p}
              </Text>
            ))}
          </Section>
        ) : null}

        <Section style={{ textAlign: 'center' as const, margin: '8px 0 6px' }}>
          <Button
            href={joinUrl}
            style={{
              backgroundColor: accent,
              color: '#fff',
              borderRadius: 10,
              padding: '14px 26px',
              fontSize: 15,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            View & join membership
          </Button>
        </Section>

        <Hr style={{ borderColor: '#eee', margin: '22px 0 12px' }} />
        <Text style={{ ...styles.text, fontSize: 12, color: brand.muted, textAlign: 'center' as const }}>
          You can cancel or ask {clinicName} to pause your membership at any time.
        </Text>
      </ModoShell>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `You're invited to join ${d?.planName ?? 'our membership'}${d?.clinicName ? ` at ${d.clinicName}` : ''}`,
  displayName: 'Membership invitation',
  previewData: {
    recipientName: 'Jane Doe',
    clinicName: 'Aesthetics by Nurse Ryan',
    planName: 'Skin Club',
    priceText: '£50.00',
    intervalLabel: 'month',
    creditText: '£55.00',
    discountPercent: 10,
    perks: ['Priority booking', 'Member-only events'],
    includedTreatments: [{ name: 'Skin review', quantity: 1 }],
    joinUrl: 'https://modobook.uk/m/aestheticsbynurseryan/memberships',
  },
} satisfies TemplateEntry
