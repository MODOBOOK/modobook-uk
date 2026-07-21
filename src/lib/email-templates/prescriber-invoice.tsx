import * as React from 'react'
import { Heading, Hr, Preview, Section, Text } from '@react-email/components'
import { BodyOverride, Head, ModoShell, brand, brandedButton, styles } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface InvoiceItem { description: string; qty: number; unitPriceCents: number }
interface BankDetails {
  bankName?: string | null
  accountName?: string | null
  sortCode?: string | null
  accountNumber?: string | null
  iban?: string | null
  swift?: string | null
  paymentReference?: string | null
}

interface Props {
  siteName?: string
  logoUrl?: string | null
  brandColor?: string | null
  bodyOverride?: string | null
  prescriberName: string
  practitionerName: string
  clinicName?: string | null
  invoiceNumber: string
  currency: string
  subtotalCents: number
  items: InvoiceItem[]
  notes?: string | null
  dueDate?: string | null
  payUrl?: string | null
  pdfUrl?: string | null
  bank?: BankDetails | null
}

function fmt(cents: number, currency: string) {
  const cur = currency === 'GBP' ? '£' : currency + ' '
  return `${cur}${(cents / 100).toFixed(2)}`
}

const Email = ({
  siteName,
  logoUrl,
  brandColor,
  bodyOverride,
  prescriberName,
  practitionerName,
  clinicName,
  invoiceNumber,
  currency,
  subtotalCents,
  items = [],
  notes,
  dueDate,
  payUrl,
  pdfUrl,
  bank,
}: Props) => (
  <>
    <Head />
    <Preview>{`Invoice ${invoiceNumber} from ${prescriberName} — ${fmt(subtotalCents, currency)}`}</Preview>
    <ModoShell preview="" siteName={siteName || prescriberName} logoUrl={logoUrl} brandColor={brandColor}>
      <Heading style={styles.h1}>Invoice from {prescriberName}</Heading>
      <Text style={styles.text}>
        {`Hi ${practitionerName}${clinicName ? ` (${clinicName})` : ''}, please find your invoice below. Your branded PDF is attached as a link.`}
      </Text>

      <BodyOverride text={bodyOverride} />

      <Section style={{ margin: '18px 0 6px' }}>
        <Text style={{ ...styles.muted, margin: 0 }}>Invoice</Text>
        <Text style={{ ...styles.text, margin: '2px 0 0', fontWeight: 600 }}>{invoiceNumber}</Text>
        {dueDate && (
          <Text style={{ ...styles.muted, margin: '10px 0 0' }}>Due {dueDate}</Text>
        )}
      </Section>

      <Hr style={styles.hr} />

      <Section>
        {items.map((it, i) => {
          const line = it.qty * it.unitPriceCents
          return (
            <Section key={i} style={{ padding: '8px 0', borderBottom: `1px solid ${brand.border}` }}>
              <table width="100%" cellPadding={0} cellSpacing={0}>
                <tbody>
                  <tr>
                    <td style={{ fontSize: 14, color: brand.ink, paddingRight: 12 }}>
                      {it.description}
                      <div style={{ fontSize: 12, color: brand.muted, marginTop: 2 }}>
                        {it.qty} × {fmt(it.unitPriceCents, currency)}
                      </div>
                    </td>
                    <td align="right" style={{ fontSize: 14, color: brand.ink, whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {fmt(line, currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
          )
        })}
      </Section>

      <Section style={{ marginTop: 14 }}>
        <table width="100%" cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td style={{ fontSize: 15, color: brand.ink, fontWeight: 700 }}>Total due</td>
              <td align="right" style={{ fontSize: 18, color: brand.ink, fontWeight: 700 }}>
                {fmt(subtotalCents, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      {(payUrl || pdfUrl) && (
        <Section style={styles.buttonWrap}>
          {payUrl && <a href={payUrl} style={brandedButton(brandColor)}>Pay now</a>}
          {pdfUrl && (
            <div style={{ marginTop: 10 }}>
              <a href={pdfUrl} style={{ ...brandedButton(brandColor), background: '#ffffff', color: brand.ink, border: `1px solid ${brand.border}` }}>
                View / download invoice PDF
              </a>
            </div>
          )}
        </Section>
      )}

      {bank && (bank.accountNumber || bank.iban) && (
        <>
          <Hr style={styles.hr} />
          <Section>
            <Text style={{ ...styles.text, margin: 0, fontWeight: 600 }}>Bank transfer details</Text>
            {bank.bankName && <Text style={{ ...styles.muted, margin: '4px 0 0' }}>Bank: {bank.bankName}</Text>}
            {bank.accountName && <Text style={{ ...styles.muted, margin: '2px 0 0' }}>Account name: {bank.accountName}</Text>}
            {bank.sortCode && <Text style={{ ...styles.muted, margin: '2px 0 0' }}>Sort code: {bank.sortCode}</Text>}
            {bank.accountNumber && <Text style={{ ...styles.muted, margin: '2px 0 0' }}>Account number: {bank.accountNumber}</Text>}
            {bank.iban && <Text style={{ ...styles.muted, margin: '2px 0 0' }}>IBAN: {bank.iban}</Text>}
            {bank.swift && <Text style={{ ...styles.muted, margin: '2px 0 0' }}>SWIFT/BIC: {bank.swift}</Text>}
            {(bank.paymentReference || invoiceNumber) && (
              <Text style={{ ...styles.muted, margin: '2px 0 0' }}>Reference: {bank.paymentReference || invoiceNumber}</Text>
            )}
          </Section>
        </>
      )}

      {notes && (
        <>
          <Hr style={styles.hr} />
          <Text style={styles.muted}>{notes}</Text>
        </>
      )}

      <Text style={styles.muted}>
        Payments are processed securely by Stripe on behalf of {prescriberName}.
      </Text>
    </ModoShell>
  </>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Invoice ${d.invoiceNumber || ''} from ${d.prescriberName || 'your prescriber'}`.trim(),
  displayName: 'Prescriber invoice',
  previewData: {
    prescriberName: 'Dr Jane Smith',
    practitionerName: 'Alex Practitioner',
    clinicName: 'Radiant Aesthetics',
    invoiceNumber: 'INV-2026-0001',
    currency: 'GBP',
    subtotalCents: 12000,
    items: [
      { description: 'Prescription — Botulinum toxin', qty: 3, unitPriceCents: 3000 },
      { description: 'Consultation fee', qty: 1, unitPriceCents: 3000 },
    ],
    dueDate: '2026-08-01',
    payUrl: 'https://example.com/pay',
    pdfUrl: 'https://example.com/invoice.pdf',
  },
} satisfies TemplateEntry
