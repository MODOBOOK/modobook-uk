// Waitlist "we're open" email — sent when MODO launches and waitlisted
// practitioners can create their account and start taking bookings.
import * as React from 'react'
import { Heading, Hr, Html, Link, Preview, Section, Text } from '@react-email/components'
import modoLogo from '@/assets/modo-logo.png.asset.json'
import { Head, ModoShell, styles, brand, brandedButton } from './_modo-brand'
import type { TemplateEntry } from './registry'

const MODO_LOGO_FULL_URL = `https://modobook.uk${modoLogo.url}`

interface WaitlistOpenProps {
  firstName?: string | null
}

const FEATURES = [
  {
    title: 'Branded booking pages',
    body: 'Your own link, your colours, your logo — clients book treatments in seconds.',
  },
  {
    title: 'Smart rebook & top-up reminders',
    body: 'Automated emails that bring clients back at exactly the right interval.',
  },
  {
    title: 'Consultation notes & photo records',
    body: 'Capture every consultation, upload before/after photos and build treatment plans in one place.',
  },
  {
    title: 'Full clinical records',
    body: 'Medical forms, consents, treatment notes and history — all in one place.',
  },
  {
    title: 'Prescriber Hub',
    body: 'Request clinic days, share records safely and get on-site sign-offs.',
  },
  {
    title: 'Training that pays you',
    body: 'List courses, take deposits and manage attendees on the same calendar.',
  },
]

const WHATSAPP_NUMBER = '+44 7385 790119'
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}`

export const WaitlistOpenEmail = ({ firstName }: WaitlistOpenProps) => {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>MODO Book is now open — create your clinic account today.</Preview>
      <ModoShell preview={null} siteName="MODO Book">
        <Heading style={{ ...styles.h1, fontStyle: 'italic' }}>MODO is officially open.</Heading>
        <Text style={styles.text}>{greeting}</Text>
        <Text style={styles.text}>
          The wait is over. MODO Book is now live and ready for your clinic. You
          can create your account, set up your branded booking page, and start
          taking appointments today.
        </Text>

        <div style={styles.buttonWrap}>
          <Link style={styles.button} href="https://modobook.uk/auth">
            Create your clinic account
          </Link>
        </div>

        <Text style={{ ...styles.text, marginTop: '24px' }}>
          As one of our founding clinics, you'll lock in your first month free
          and our founding price of{' '}
          <strong>£29.99/month</strong> — no card required to get started.
        </Text>

        <Text style={{ ...styles.text, fontWeight: 600, marginTop: '28px', marginBottom: '18px' }}>
          What's included from day one:
        </Text>

        <FeatureGrid features={FEATURES} />

        {/* Notifications */}
        <Section
          style={{
            backgroundColor: brand.soft,
            borderRadius: '14px',
            padding: '24px',
            marginTop: '28px',
          }}
        >
          <Text style={{ ...styles.text, margin: 0, fontWeight: 600, fontSize: '16px' }}>
            Turn on notifications straight to your phone
          </Text>
          <Text style={{ ...styles.muted, margin: '10px 0 0' }}>
            Get new bookings, cancellations and reminders the moment they happen —
            no need to keep checking your diary.
          </Text>

          <ol style={{ ...styles.text, margin: '16px 0 0', paddingLeft: '18px' }}>
            <li>Open <strong>modobook.uk</strong> and sign in to your clinic account.</li>
            <li>Go to <strong>Dashboard → Settings</strong>.</li>
            <li>Tap <strong>Enable notifications</strong>.</li>
            <li>Choose <strong>Allow</strong> when your phone asks — that's it.</li>
          </ol>
        </Section>


        {/* WhatsApp support */}
        <Section
          style={{
            backgroundColor: brand.ink,
            borderRadius: '14px',
            padding: '24px',
            marginTop: '20px',
            textAlign: 'center',
          }}
        >
          <Text style={{ ...styles.text, margin: 0, color: '#ffffff', fontWeight: 600, fontSize: '16px' }}>
            Need help getting set up?
          </Text>
          <Text style={{ ...styles.muted, margin: '10px 0 0', color: 'rgba(255,255,255,0.75)' }}>
            Message us on WhatsApp and we'll walk you through your first booking.
          </Text>
          <div style={{ ...styles.buttonWrap, marginBottom: 0 }}>
            <Link
              style={{
                ...brandedButton(brand.accent),
                display: 'inline-block',
              }}
              href={WHATSAPP_LINK}
            >
              Chat on WhatsApp
            </Link>
          </div>
          <Text style={{ ...styles.muted, margin: '12px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>
            {WHATSAPP_NUMBER}
          </Text>
        </Section>

        <Hr style={styles.hr} />

        <Text style={styles.muted}>
          Got questions before you start? Just reply to this email or message us
          on WhatsApp — it lands straight with the founders at{' '}
          <Link href="mailto:info@modobook.co.uk" style={styles.link}>
            info@modobook.co.uk
          </Link>
          .
        </Text>

        <Text style={styles.muted}>— The MODO Book team</Text>
      </ModoShell>
    </Html>
  )
}

function FeatureGrid({ features }: { features: typeof FEATURES }) {
  return (
    <>
      {features.map((feature) => (
        <div
          key={feature.title}
          style={{
            backgroundColor: brand.soft,
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '12px',
          }}
        >
          <Text style={{ ...styles.text, margin: 0, fontWeight: 600, fontSize: '14px' }}>
            {feature.title}
          </Text>
          <Text style={{ ...styles.muted, margin: '6px 0 0', fontSize: '12px' }}>
            {feature.body}
          </Text>
        </div>
      ))}
    </>
  )
}

export const template: TemplateEntry = {
  component: WaitlistOpenEmail,
  subject: 'MODO Book is now open — create your clinic account 🎉',
  displayName: 'Waitlist open announcement',
  previewData: {
    firstName: 'Alex',
  },
}

export default WaitlistOpenEmail
