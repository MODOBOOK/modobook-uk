import * as React from 'react'
import { Button, Heading, Html, Link, Preview, Text } from '@react-email/components'
import { Head, ModoShell, styles } from './_modo-brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
  introOverride?: string | null
  closingOverride?: string | null
}

export const RecoveryEmail = ({ siteName, confirmationUrl, introOverride, closingOverride }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password for {siteName}</Preview>
    <ModoShell preview={null} siteName={siteName}>
      <Heading style={styles.h1}>Reset your password</Heading>
      {introOverride ? (
        <Text style={styles.text}>{introOverride}</Text>
      ) : (
        <Text style={styles.text}>
          We received a request to reset your password for {siteName}. Choose a new one below — the link expires shortly.
        </Text>
      )}
      <div style={styles.buttonWrap}>
        <Button style={styles.button} href={confirmationUrl}>Choose a new password</Button>
      </div>
      <Text style={styles.muted}>
        Didn&rsquo;t request this? You can safely ignore this email — your password stays the same.
      </Text>
      <Text style={styles.muted}>
        Link not working?{' '}
        <Link href={confirmationUrl} style={styles.link}>{confirmationUrl}</Link>
      </Text>
      {closingOverride && <Text style={styles.text}>{closingOverride}</Text>}
    </ModoShell>
  </Html>
)

export default RecoveryEmail
