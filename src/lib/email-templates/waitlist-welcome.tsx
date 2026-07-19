// Waitlist welcome — sent when a practitioner joins the MODO launch list.
// Warm, editorial tone. Highlights what to expect and key features.
import * as React from 'react'
import { Heading, Html, Link, Preview, Text } from '@react-email/components'
import { Head, ModoShell, styles, brand } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface WaitlistWelcomeProps {
  firstName?: string | null
}

export const WaitlistWelcomeEmail = ({ firstName }: WaitlistWelcomeProps) => {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>You're on the MODO launch list — here's what's coming.</Preview>
      <ModoShell preview={null} siteName="MODO Book">
        <Heading style={styles.h1}>Welcome to the MODO launch list.</Heading>
        <Text style={styles.text}>{greeting}</Text>
        <Text style={styles.text}>
          Thanks for joining us early. MODO Book is the booking and clinical
          platform built by aesthetics clinicians, for aesthetics clinicians —
          and you're now first in line when we open the doors over the next
          few weeks.
        </Text>

        <Text style={{ ...styles.text, fontWeight: 600, marginTop: '24px' }}>
          What to keep your eyes peeled for:
        </Text>

        <FeatureRow
          title="Smart bookings & rebooking reminders"
          body="Branded booking pages, auto-reminders and rebook/top-up nudges that bring clients back on time — without you lifting a finger."
        />
        <FeatureRow
          title="Full clinical records in one place"
          body="Medical forms, consents, treatment history, photos and face mapping — all consented, all searchable, all yours."
        />
        <FeatureRow
          title="Prescriber Hub"
          body="Request clinic days with a prescriber, share the record safely, and get on-site sign-offs without the WhatsApp chaos."
        />
        <FeatureRow
          title="Training that pays you"
          body="List your courses alongside your treatments, take deposits and manage attendees on the same calendar."
        />
        <FeatureRow
          title="Marketing that respects your clients"
          body="Birthday notes, treatment intervals and newsletters — sent from your brand, with unsubscribe handled for you."
        />

        <Text style={{ ...styles.text, marginTop: '28px' }}>
          <strong>Founding pricing:</strong> £19.99/month (from £29.99),
          additional team members £9.99, additional locations £4.99. The first
          month is on us — no card required to get started.
        </Text>

        <Text style={styles.text}>
          We'll email you the moment your account is ready. In the meantime,
          have a look around and see what's coming:
        </Text>

        <div style={styles.buttonWrap}>
          <Link style={styles.button} href="https://modobook.uk">
            Explore MODO
          </Link>
        </div>

        <Text style={styles.muted}>
          Questions or want to tell us what you'd love MODO to solve? Just
          reply to this email — it lands straight with the founders at{' '}
          <Link href="mailto:hello@modobook.uk" style={styles.link}>
            hello@modobook.uk
          </Link>
          .
        </Text>

        <Text style={styles.muted}>— The MODO Book team</Text>
      </ModoShell>
    </Html>
  )
}

function FeatureRow({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        borderLeft: `3px solid ${brand.accent}`,
        padding: '4px 0 4px 14px',
        margin: '14px 0',
      }}
    >
      <Text style={{ ...styles.text, margin: 0, fontWeight: 600 }}>{title}</Text>
      <Text style={{ ...styles.muted, margin: '4px 0 0 0' }}>{body}</Text>
    </div>
  )
}

export const template: TemplateEntry = {
  component: WaitlistWelcomeEmail,
  subject: "You're on the MODO launch list 🎉",
  displayName: 'Waitlist welcome',
  previewData: {
    firstName: 'Alex',
  },
}

export default WaitlistWelcomeEmail
