import * as React from 'react'
import { Html, Preview, Heading, Text, Button, Section } from '@react-email/components'
import { ModoShell, Head, styles, brandedButton } from './_modo-brand'
import type { TemplateEntry } from './registry'

interface Props {
  inviteeName?: string
  clinicName?: string
  role?: string
  inviterName?: string
  acceptUrl?: string
  logoUrl?: string | null
  brandColor?: string | null
}

const Email = ({
  inviteeName = 'there',
  clinicName = 'MODO',
  role = 'team member',
  inviterName,
  acceptUrl = 'https://modobook.uk',
  logoUrl,
  brandColor,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {clinicName} on MODO</Preview>
    <ModoShell preview="" siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
      <Heading as="h1" style={styles.h1}>You're invited to join {clinicName}</Heading>
      <Text style={styles.text}>
        Hi {inviteeName},{inviterName ? ` ${inviterName} at` : ''} <strong>{clinicName}</strong> has invited you to join their team on MODO as <strong>{role}</strong>.
      </Text>
      <Text style={styles.text}>
        Click below to accept your invite. You'll be asked to set a password (or sign in if you already have a MODO account) and then be taken straight into the clinic dashboard.
      </Text>
      <Section style={styles.buttonWrap}>
        <Button href={acceptUrl} style={brandedButton(brandColor)}>Accept invitation</Button>
      </Section>
      <Text style={styles.muted}>This invite expires in 7 days. If you weren't expecting this email, you can safely ignore it.</Text>
    </ModoShell>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => {
    const clinic = (d.clinicName as string) || 'MODO'
    return `You've been invited to join ${clinic} on MODO`
  },
  displayName: 'Staff invitation',
  previewData: {
    inviteeName: 'Sam',
    clinicName: 'MODO Clinic',
    role: 'Practitioner',
    inviterName: 'Dr. Alex',
    acceptUrl: 'https://modobook.uk/staff-accept/demo-token',
  },
} satisfies TemplateEntry
