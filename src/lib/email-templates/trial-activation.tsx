import * as React from 'react'
import { Html, Preview, Heading, Text, Button, Section } from '@react-email/components'
import { ModoShell, Head, styles, brandedButton } from './_modo-brand'
import type { TemplateEntry } from './registry'

type Stage = 'before' | 'ended' | 'final'

interface Props {
  stage?: Stage
  clinicName?: string
  trialEndLabel?: string
  closeOnLabel?: string
  billingUrl?: string
}

const copy = (stage: Stage, trialEnd: string, closeOn: string) => {
  if (stage === 'before')
    return {
      h: 'Your free trial ends in 3 days',
      p: `Your MODO trial ends on ${trialEnd}. Activate your subscription to keep your booking page, diary and patient records running without interruption.`,
    }
  if (stage === 'ended')
    return {
      h: 'Your free trial has ended',
      p: `Your MODO trial ended on ${trialEnd}. You have 7 days, until ${closeOn}, to activate your subscription. After that your account may be closed.`,
    }
  return {
    h: '2 days left to activate',
    p: `Your account may be closed on ${closeOn} if no subscription is activated. If it is closed, you can still download your patient records for 30 days.`,
  }
}

const Email = ({
  stage = 'before',
  clinicName = 'your clinic',
  trialEndLabel = '',
  closeOnLabel = '',
  billingUrl = 'https://modobook.uk/dashboard/billing',
}: Props) => {
  const c = copy(stage, trialEndLabel, closeOnLabel)
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{c.h}</Preview>
      <ModoShell preview="" siteName="MODO">
        <Heading as="h1" style={styles.h1}>{c.h}</Heading>
        <Text style={styles.text}>Hi {clinicName},</Text>
        <Text style={styles.text}>{c.p}</Text>
        <Section style={styles.buttonWrap}>
          <Button href={billingUrl} style={brandedButton(null)}>Activate subscription</Button>
        </Section>
        <Text style={styles.muted}>Questions? Reply to info@modobook.co.uk.</Text>
      </ModoShell>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    d.stage === 'ended'
      ? 'Your MODO trial has ended — 7 days to activate'
      : d.stage === 'final'
        ? '2 days left to activate your MODO account'
        : 'Your MODO trial ends in 3 days',
  displayName: 'Trial activation reminder',
  previewData: { stage: 'ended', clinicName: 'MODO Clinic', trialEndLabel: '20 October', closeOnLabel: '27 October' },
} satisfies TemplateEntry
