import * as React from 'react'
import { Html, Preview, Heading, Text, Section, Hr } from '@react-email/components'
import { ModoShell, Head, styles, brand } from './_modo-brand'
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
  const expiryText = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const accent = brandColor || brand.accent
  const firstName = (recipientName || 'there').split(' ')[0]
  const hasValue = typeof amount === 'number' && amount > 0

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{buyerName ? `${buyerName} sent you a gift` : `A gift from ${clinicName}`} — code inside</Preview>
      <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
        <Text style={{ ...styles.text, textAlign: 'center' as const, textTransform: 'uppercase' as const, letterSpacing: '3px', fontSize: 10, color: accent, margin: '0 0 6px', fontWeight: 600 }}>
          A gift for you
        </Text>
        <Heading as="h1" style={{ ...styles.h1, textAlign: 'center' as const, fontSize: 28, margin: '0 0 6px' }}>
          {buyerName ? `${buyerName} sent you a gift` : `You've received a gift`}
        </Heading>
        <Text style={{ ...styles.text, textAlign: 'center' as const, color: brand.muted, margin: '0 0 24px' }}>
          Hi {firstName}, enjoy something special at {clinicName}.
        </Text>

        {/* The card */}
        <Section
          style={{
            background: `linear-gradient(135deg, ${accent} 0%, ${brand.headerCard} 100%)`,
            backgroundColor: accent,
            borderRadius: 16,
            padding: '32px 24px',
            margin: '0 0 22px',
            textAlign: 'center' as const,
            color: '#fff',
          }}
        >
          <Text style={{ margin: 0, fontSize: 11, letterSpacing: '3px', textTransform: 'uppercase' as const, opacity: 0.85, color: '#fff' }}>
            {clinicName} · Gift Card
          </Text>
          <Text style={{ margin: '10px 0 0', fontSize: 15, fontWeight: 500, color: '#fff' }}>{cardName}</Text>
          {hasValue && (
            <Heading as="h2" style={{ margin: '14px 0 6px', fontSize: 44, fontWeight: 400, color: '#fff', fontFamily: "'Georgia', 'Times New Roman', serif" }}>
              £{amount!.toFixed(2)}
            </Heading>
          )}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.35)', margin: '18px auto 14px', width: 60 }} />
          <Text style={{ margin: '0 0 6px', fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase' as const, opacity: 0.85, color: '#fff' }}>
            Redemption code
          </Text>
          <div
            style={{
              display: 'inline-block',
              backgroundColor: 'rgba(255,255,255,0.15)',
              border: '1px dashed rgba(255,255,255,0.6)',
              borderRadius: 10,
              padding: '10px 18px',
              fontFamily: "'Menlo', 'Courier New', monospace",
              fontSize: 20,
              letterSpacing: '3px',
              fontWeight: 600,
              color: '#fff',
            }}
          >
            {code}
          </div>
          {expiryText && (
            <Text style={{ margin: '14px 0 0', fontSize: 12, opacity: 0.85, color: '#fff' }}>Valid until {expiryText}</Text>
          )}
        </Section>

        {message && (
          <Section style={{ backgroundColor: brand.soft, borderRadius: 12, padding: '18px 20px', margin: '0 0 22px' }}>
            <Text style={{ ...styles.text, textTransform: 'uppercase' as const, letterSpacing: '2px', fontSize: 10, color: brand.muted, margin: '0 0 8px', fontWeight: 600 }}>
              A note{buyerName ? ` from ${buyerName}` : ''}
            </Text>
            <Text style={{ ...styles.text, fontStyle: 'italic' as const, margin: 0, fontSize: 15, lineHeight: 1.6 }}>
              &ldquo;{message}&rdquo;
            </Text>
          </Section>
        )}

        <Heading as="h3" style={{ ...styles.h1, fontSize: 16, margin: '0 0 10px' }}>How to redeem</Heading>
        <Text style={{ ...styles.text, margin: '0 0 6px' }}>1. Book a treatment with {clinicName} online.</Text>
        <Text style={{ ...styles.text, margin: '0 0 6px' }}>2. At checkout, paste the code above into the gift-card field.</Text>
        <Text style={{ ...styles.text, margin: '0 0 18px' }}>3. Enjoy your treatment — the balance is applied automatically.</Text>

        <Hr style={{ borderColor: brand.border, margin: '10px 0 14px' }} />
        <Text style={{ ...styles.text, fontSize: 12, color: brand.muted, margin: 0, textAlign: 'center' as const }}>
          Keep this email safe — the code above is your proof of gift.
        </Text>
      </ModoShell>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d) => (d.buyerName ? `${d.buyerName} sent you a gift from ${d.clinicName ?? 'us'}` : `You've received a gift from ${d.clinicName ?? 'us'}`),
  displayName: 'Gift card delivery',
  previewData: {
    recipientName: 'Sam',
    code: 'GIFT-XKQ7-9M2P',
    cardName: '£100 Gift Card',
    amount: 100,
    buyerName: 'Alex',
    message: 'Happy birthday! Treat yourself to something lovely x',
  },
} satisfies TemplateEntry
