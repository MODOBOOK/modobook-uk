import * as React from 'react'
import { Html, Preview, Heading, Text, Button, Section } from '@react-email/components'
import { ModoShell, Head, styles, brandedButton } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Props {
  practitionerName?: string
  clinicName?: string
  amountFormatted?: string
  attemptCount?: number
  hostedInvoiceUrl?: string
  billingUrl?: string
  logoUrl?: string | null
  brandColor?: string | null
}

const Email = ({
  practitionerName = 'there',
  clinicName = 'MODO',
  amountFormatted = '£0.00',
  attemptCount = 1,
  hostedInvoiceUrl,
  billingUrl = 'https://modobook.uk/dashboard/billing',
  logoUrl,
  brandColor,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Payment for your MODO subscription failed — {amountFormatted} outstanding</Preview>
    <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
      <Heading as="h1" style={styles.h1}>Your MODO payment didn't go through</Heading>
      <Text style={styles.text}>Hi {practitionerName},</Text>
      <Text style={styles.text}>
        We tried to take <strong>{amountFormatted}</strong> for your MODO subscription and the payment was declined
        {attemptCount > 1 ? ` (attempt ${attemptCount})` : ''}. Your account is now in a <strong>7-day grace period</strong> — everything keeps working, but if the balance isn't cleared before it ends your dashboard will be locked.
      </Text>
      <Section style={styles.buttonWrap}>
        <Button href={hostedInvoiceUrl || billingUrl} style={brandedButton(brandColor)}>
          {hostedInvoiceUrl ? 'Pay outstanding invoice' : 'Fix billing'}
        </Button>
      </Section>
      <Text style={styles.muted}>
        You can also manage your payment method and view all invoices from your MODO dashboard → Plan &amp; billing.
      </Text>
    </ModoShell>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Action needed — MODO payment of ${(d.amountFormatted as string) || ''} failed`,
  displayName: 'Platform arrears notice',
  previewData: {
    practitionerName: 'Sam',
    clinicName: 'MODO Clinic',
    amountFormatted: '£39.99',
    attemptCount: 2,
    hostedInvoiceUrl: 'https://invoice.stripe.com/example',
  },
} satisfies TemplateEntry
