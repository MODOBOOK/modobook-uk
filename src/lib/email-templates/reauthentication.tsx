import * as React from 'react'
import { Heading, Html, Preview, Text } from '@react-email/components'
import { Head, ModoShell, styles } from './_modo-brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your MODO verification code</Preview>
    <ModoShell preview={null} siteName="MODO">
      <Heading style={styles.h1}>Confirm it&rsquo;s you</Heading>
      <Text style={styles.text}>Use the code below to confirm your identity:</Text>
      <div style={styles.buttonWrap}>
        <span style={styles.code}>{token}</span>
      </div>
      <Text style={styles.muted}>
        This code expires shortly. If you didn&rsquo;t request it, you can safely ignore this email.
      </Text>
    </ModoShell>
  </Html>
)

export default ReauthenticationEmail
