import * as React from 'react'
import { Button, Heading, Html, Link, Preview, Text } from '@react-email/components'
import { Head, ModoShell, styles } from './_modo-brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
  introOverride?: string | null
  closingOverride?: string | null
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl, introOverride, closingOverride }: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You&rsquo;ve been invited to join {siteName}</Preview>
    <ModoShell preview={null} siteName={siteName}>
      <Heading style={styles.h1}>You&rsquo;re invited</Heading>
      {introOverride ? (
        <Text style={styles.text}>{introOverride}</Text>
      ) : (
        <Text style={styles.text}>
          You&rsquo;ve been invited to join{' '}
          <Link href={siteUrl} style={styles.link}><strong>{siteName}</strong></Link>{' '}
          on MODO. Accept your invitation to set up your account and start collaborating.
        </Text>
      )}
      <div style={styles.buttonWrap}>
        <Button style={styles.button} href={confirmationUrl}>Accept invitation</Button>
      </div>
      <Text style={styles.muted}>
        If you weren&rsquo;t expecting this, you can safely ignore this email.
      </Text>
      {closingOverride && <Text style={styles.text}>{closingOverride}</Text>}
    </ModoShell>
  </Html>
)

export default InviteEmail
