import * as React from 'react'
import { Button, Heading, Html, Link, Preview, Text } from '@react-email/components'
import { Head, ModoShell, styles } from './_modo-brand'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
  introOverride?: string | null
  closingOverride?: string | null
}

export const EmailChangeEmail = ({ siteName, oldEmail, newEmail, confirmationUrl, introOverride, closingOverride }: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email change for {siteName}</Preview>
    <ModoShell preview={null} siteName={siteName}>
      <Heading style={styles.h1}>Confirm your email change</Heading>
      {introOverride ? (
        <Text style={styles.text}>{introOverride}</Text>
      ) : (
        <Text style={styles.text}>
          You requested to change your {siteName} email from{' '}
          <Link href={`mailto:${oldEmail}`} style={styles.link}>{oldEmail}</Link>{' '}
          to{' '}
          <Link href={`mailto:${newEmail}`} style={styles.link}>{newEmail}</Link>.
        </Text>
      )}
      <div style={styles.buttonWrap}>
        <Button style={styles.button} href={confirmationUrl}>Confirm email change</Button>
      </div>
      <Text style={styles.muted}>
        If you didn&rsquo;t request this, please secure your account right away.
      </Text>
      {closingOverride && <Text style={styles.text}>{closingOverride}</Text>}
    </ModoShell>
  </Html>
)

export default EmailChangeEmail
