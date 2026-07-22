import * as React from 'react'
import { Html, Preview, Heading, Text, Section } from '@react-email/components'
import { ModoShell, Head, styles } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Props {
  recipientName?: string
  code?: string
  cardName?: string
  amount?: number | null
  expiresAt?: string | null
  message?: string | null
  buyerName?: string | null
  clinicName?: string
  logoUrl?: string | null
  brandColor?: string | null
}

const Email = ({
  recipientName = 'there',
  code = 'GIFT-XXXX-XXXX',
  cardName = 'Gift card',
  amount,
  expiresAt,
  message,
  buyerName,
  clinicName = 'MODO',
  logoUrl,
  brandColor,
}: Props) => {
  const expiryText = expiresAt ? new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>You've received a gift card from {clinicName}</Preview>
      <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
        <Heading as="h1" style={styles.h1}>You've received a gift card</Heading>
        <Text style={styles.text}>
          Hi {recipientName}, {buyerName ? `${buyerName} has` : 'someone has'} sent you a gift card for {clinicName}.
        </Text>

        <Section style={{ backgroundColor: '#f5f1ea', borderRadius: 14, padding: '24px 20px', margin: '16px 0 20px', textAlign: 'center' as const }}>
          <Text style={{ ...styles.text, margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '1.5px', fontSize: 11, opacity: 0.7 }}>{cardName}</Text>
          {typeof amount === 'number' && amount > 0 && (
            <Heading as="h2" style={{ ...styles.h1, margin: '4px 0 12px', fontSize: 34 }}>£{amount.toFixed(2)}</Heading>
          )}
          <Text style={{ ...styles.text, margin: '10px 0 4px', fontSize: 12, opacity: 0.7 }}>Redemption code</Text>
          <Text style={{ ...styles.text, fontSize: 22, letterSpacing: '2px', fontWeight: 600, margin: 0 }}>{code}</Text>
          {expiryText && (
            <Text style={{ ...styles.text, margin: '14px 0 0', fontSize: 12, opacity: 0.7 }}>Valid until {expiryText}</Text>
          )}
        </Section>

        {message && (
          <Section style={{ borderLeft: '3px solid #d9c8ae', padding: '4px 14px', margin: '4px 0 20px' }}>
            <Text style={{ ...styles.text, fontStyle: 'italic' as const, margin: 0 }}>"{message}"</Text>
          </Section>
        )}

        <Text style={styles.text}>
          To use it, enter the code at checkout when you book a treatment with {clinicName}.
        </Text>
      </ModoShell>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d) => `You've received a gift card from ${d.clinicName ?? 'us'}`,
  displayName: 'Gift card delivery',
  previewData: { recipientName: 'Sam', code: 'GIFT-XKQ7-9M2P', cardName: '£100 Gift Card', amount: 100, buyerName: 'Alex' },
} satisfies TemplateEntry
