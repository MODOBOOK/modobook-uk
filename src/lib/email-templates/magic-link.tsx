import * as React from 'react'
import { Button, Heading, Html, Link, Preview, Text } from '@react-email/components'
import { Head, ModoShell, styles } from './_modo-brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
  introOverride?: string | null
  closingOverride?: string | null
}

export const MagicLinkEmail = ({ siteName, confirmationUrl, introOverride, closingOverride }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your secure sign-in link for {siteName}</Preview>
    <ModoShell preview={null} siteName={siteName}>
      <Heading style={styles.h1}>Sign in to {siteName}</Heading>
      {introOverride ? (
        <Text style={styles.text}>{introOverride}</Text>
      ) : (
        <Text style={styles.text}>
          Tap the button below to open your studio. This one-time link expires shortly for your security.
        </Text>
      )}
      <div style={styles.buttonWrap}>
        <Button style={styles.button} href={confirmationUrl}>Open MODO</Button>
      </div>
      <Text style={styles.muted}>
        Or copy this link into your browser:<br />
        <Link href={confirmationUrl} style={styles.link}>{confirmationUrl}</Link>
      </Text>
      {closingOverride && <Text style={styles.text}>{closingOverride}</Text>}
    </ModoShell>
  </Html>
)

export default MagicLinkEmail
