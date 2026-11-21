import * as React from 'react'
import { Html, Preview, Heading, Text, Section, Button } from '@react-email/components'
import { ModoShell, Head, styles, brand } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Props {
  buyerName?: string | null
  buyerEmail?: string | null
  recipientName?: string | null
  recipientEmail?: string | null
  cardName?: string
  amount?: number | null
  code?: string
  message?: string | null
  clinicName?: string
  logoUrl?: string | null
  brandColor?: string | null
}

const Row = ({ label, value }: { label: string; value?: string | null }) =>
  value ? (
    <Text style={{ ...styles.text, margin: '0 0 6px' }}>
      <strong>{label}:</strong> {value}
    </Text>
  ) : null

const Email = ({ buyerName, buyerEmail, recipientName, recipientEmail, cardName = 'Gift card', amount, code = 'GIFT-XXXX-XXXX', message, clinicName = 'MODO', logoUrl, brandColor }: Props) => {
  const value = typeof amount === 'number' && amount > 0 ? `£${amount.toFixed(2)}` : null
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>New gift card purchased{value ? ` — ${value}` : ''}</Preview>
      <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
        <Heading as="h1" style={{ ...styles.h1, fontSize: 24 }}>🎁 New gift card purchased</Heading>
        <Text style={{ ...styles.text, color: brand.muted, margin: '0 0 18px' }}>
          {buyerName || 'A customer'} has bought a gift card from {clinicName} online. Payment is confirmed and the code is active.
        </Text>
        <Section style={{ backgroundColor: brand.soft, borderRadius: 12, padding: '18px 20px', margin: '0 0 18px' }}>
          <Row label="Gift card" value={cardName} />
          <Row label="Value" value={value} />
          <Row label="Code" value={code} />
          <Row label="Bought by" value={[buyerName, buyerEmail].filter(Boolean).join(' · ') || null} />
          <Row label="For" value={[recipientName, recipientEmail].filter(Boolean).join(' · ') || null} />
          <Row label="Message" value={message ? `“${message}”` : null} />
        </Section>
        <Button href="https://modobook.uk/dashboard/gift-cards" style={{ ...styles.button }}>View gift cards</Button>
      </ModoShell>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d) => `New gift card purchased${typeof d.amount === 'number' && d.amount > 0 ? ` — £${Number(d.amount).toFixed(2)}` : ''}`,
  displayName: 'Gift card — clinic alert',
  previewData: { buyerName: 'Alex Smith', buyerEmail: 'alex@example.com', recipientName: 'Sam', cardName: '£100 Gift Card', amount: 100, code: 'GIFT-XKQ7-9M2P', message: 'Happy birthday!' },
} satisfies TemplateEntry
