// Admin broadcast — sent from the platform admin to practitioners or a
// specific user account. Plain text message plus optional single CTA button.
import * as React from 'react'
import { Button, Heading, Html, Link, Preview, Text } from '@react-email/components'
import { Head, ModoShell, styles } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface AdminBroadcastProps {
  subject?: string
  message?: string
  ctaText?: string | null
  ctaUrl?: string | null
  firstName?: string | null
}

export const AdminBroadcastEmail = ({
  subject = 'A message from Modo Book',
  message = '',
  ctaText,
  ctaUrl,
  firstName,
}: AdminBroadcastProps) => {
  // Split message into paragraphs on blank lines so admins can format
  // multi-paragraph updates naturally.
  const paragraphs = String(message || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{subject}</Preview>
      <ModoShell preview={null} siteName="Modo Book">
        <Heading style={styles.h1}>{subject}</Heading>
        {firstName && <Text style={styles.text}>Hi {firstName},</Text>}
        {paragraphs.length === 0 ? (
          <Text style={styles.text}>{message}</Text>
        ) : (
          paragraphs.map((p, i) => (
            <Text key={i} style={styles.text}>
              {p.split('\n').map((line, j, arr) => (
                <React.Fragment key={j}>
                  {line}
                  {j < arr.length - 1 && <br />}
                </React.Fragment>
              ))}
            </Text>
          ))
        )}
        {ctaText && ctaUrl && (
          <div style={styles.buttonWrap}>
            <Button style={styles.button} href={ctaUrl}>{ctaText}</Button>
          </div>
        )}
        {ctaText && ctaUrl && (
          <Text style={styles.muted}>
            Or copy this link:{' '}
            <Link href={ctaUrl} style={styles.link}>{ctaUrl}</Link>
          </Text>
        )}
        <Text style={styles.muted}>— The Modo Book team</Text>
      </ModoShell>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: AdminBroadcastEmail,
  subject: (data) => (data as AdminBroadcastProps).subject || 'A message from Modo Book',
  displayName: 'Admin broadcast',
  previewData: {
    subject: 'A quick update from the Modo team',
    message: 'Hi there,\n\nWe just shipped a new feature we think you\'ll love.\n\nLet us know what you think!',
    ctaText: 'See what\'s new',
    ctaUrl: 'https://modobook.uk',
    firstName: 'Alex',
  },
}

export default AdminBroadcastEmail
