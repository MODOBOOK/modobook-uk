// Waitlist welcome — sent when a practitioner joins the MODO launch list.
// Rich, visual email with feature cards, launch badge and warm editorial tone.
import * as React from 'react'
import { Column, Heading, Hr, Html, Img, Link, Preview, Row, Section, Text } from '@react-email/components'
import { Head, ModoShell, styles, brand } from './_modo-brand'
import type { TemplateEntry } from './registry'
import modoWordmark from '@/assets/modo-wordmark.png.asset.json'

interface WaitlistWelcomeProps {
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
  {
    title: 'Marketing that respects clients',
    body: 'Birthday notes, treatment intervals and newsletters sent from your brand.',
  },
  {
    title: 'Payments & invoices',
    body: 'Take deposits, sell packages and keep track of what you’re owed.',
  },
]

export const WaitlistWelcomeEmail = ({ firstName }: WaitlistWelcomeProps) => {
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>You're on the MODO launch list — here's what's coming.</Preview>
      <ModoShell preview={null} siteName="MODO Book">
        {/* Hero banner */}
        <Section
          style={{
            backgroundColor: brand.soft,
            borderRadius: '14px',
            padding: '28px 24px',
            textAlign: 'center',
            marginBottom: '28px',
          }}
        >
          <Img
            src={`https://modobook.uk${modoWordmark.url}`}
            alt="MODO Book"
            height="42"
            style={{ height: '42px', width: 'auto', margin: '0 auto 16px', display: 'inline-block' }}
          />
          <Text
            style={{
              ...styles.muted,
              margin: 0,
              fontSize: '12px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Launch list
          </Text>
        </Section>

        <Heading style={styles.h1}>You're first in line.</Heading>
        <Text style={styles.text}>{greeting}</Text>
        <Text style={styles.text}>
          Thanks for joining us early. MODO Book is the booking and clinical
          platform built by aesthetics clinicians, for every aesthetics
          practitioner — and you're now first in line when we open the doors
          over the next few weeks.
        </Text>

        <Text style={{ ...styles.text, fontWeight: 600, marginTop: '28px', marginBottom: '18px' }}>
          Here's what to keep your eyes peeled for:
        </Text>

        <FeatureGrid features={FEATURES} />

        {/* Pricing card */}
        <Section
          style={{
            backgroundColor: brand.soft,
            borderRadius: '14px',
            padding: '24px',
            marginTop: '28px',
            textAlign: 'center',
          }}
        >
          <Text style={{ ...styles.text, margin: 0, fontWeight: 600, fontSize: '16px' }}>
            Founding pricing
          </Text>
          <Text style={{ ...styles.text, margin: '8px 0 0' }}>
            <span style={{ textDecoration: 'line-through', color: brand.muted }}>£29.99</span>{' '}
            <span style={{ fontSize: '22px', fontWeight: 600, color: brand.ink }}>£19.99</span>/month
          </Text>
          <Text style={{ ...styles.muted, margin: '10px 0 0' }}>
            Additional team members £9.99 · Additional locations £4.99
          </Text>
          <Text
            style={{
              ...styles.text,
              margin: '14px 0 0',
              fontWeight: 600,
              color: brand.accent,
            }}
          >
            First month free · No card required
          </Text>
        </Section>

        <Text style={{ ...styles.text, marginTop: '28px' }}>
          We'll email you the moment your account is ready. In the meantime,
          have a look around and see what's coming:
        </Text>

        <div style={styles.buttonWrap}>
          <Link style={styles.button} href="https://modobook.uk">
            Explore MODO
          </Link>
        </div>

        <Hr style={styles.hr} />

        <Text style={styles.muted}>
          Got an idea for MODO, or want to tell us what you'd love it to solve?
          Just reply to this email — it lands straight with the founders at{' '}
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
  const rows: (typeof FEATURES)[] = []
  for (let i = 0; i < features.length; i += 2) {
    rows.push(features.slice(i, i + 2))
  }

  return (
    <>
      {rows.map((row, rowIndex) => (
        <Row key={rowIndex} style={{ marginBottom: '14px' }}>
          {row.map((feature, colIndex) => (
            <Column
              key={colIndex}
              style={{
                width: '50%',
                paddingRight: colIndex === 0 ? '8px' : '0',
                paddingLeft: colIndex === 1 ? '8px' : '0',
                verticalAlign: 'top',
              }}
            >
              <div
                style={{
                  backgroundColor: brand.soft,
                  borderRadius: '12px',
                  padding: '18px',
                  height: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: brand.accent,
                    color: brand.accentInk,
                    fontSize: '14px',
                    lineHeight: '28px',
                    textAlign: 'center',
                    fontWeight: 700,
                    marginBottom: '10px',
                  }}
                >
                  {rowIndex * 2 + colIndex + 1}
                </div>
                <Text style={{ ...styles.text, margin: 0, fontWeight: 600, fontSize: '14px' }}>
                  {feature.title}
                </Text>
                <Text style={{ ...styles.muted, margin: '6px 0 0', fontSize: '12px' }}>
                  {feature.body}
                </Text>
              </div>
            </Column>
          ))}
        </Row>
      ))}
    </>
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
