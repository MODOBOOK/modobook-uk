import * as React from 'react'
import { Button, Heading, Html, Link, Preview, Text } from '@react-email/components'
import { Head, ModoShell, styles } from './_modo-brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  introOverride?: string | null
  closingOverride?: string | null
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl, introOverride, closingOverride }: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {siteName} — confirm your email to get started</Preview>
    <ModoShell preview={null} siteName={siteName}>
      <Heading style={styles.h1}>Welcome to {siteName}.</Heading>
      {introOverride ? (
        <Text style={styles.text}>{introOverride}</Text>
      ) : (
        <Text style={styles.text}>
          We&rsquo;re delighted to have you. Confirm the email address{' '}
          <Link href={`mailto:${recipient}`} style={styles.link}>{recipient}</Link>{' '}
          to activate your studio and start crafting your booking experience.
        </Text>
      )}
      <div style={styles.buttonWrap}>
        <Button style={styles.button} href={confirmationUrl}>Confirm my email</Button>
      </div>
      <Text style={styles.muted}>
        Prefer a plain link?{' '}
        <Link href={confirmationUrl} style={styles.link}>{confirmationUrl}</Link>
      </Text>
      <Text style={styles.muted}>
        You can preview your booking page any time at{' '}
        <Link href={siteUrl} style={styles.link}>{siteUrl}</Link>.
      </Text>
      {closingOverride && <Text style={styles.text}>{closingOverride}</Text>}
    </ModoShell>
  </Html>
)

export default SignupEmail
