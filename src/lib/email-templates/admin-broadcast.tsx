// Admin broadcast — sent from the platform admin to practitioners, the launch
// waitlist, or a specific user account. Supports a simple plain-text message
// plus optional content blocks (images, buttons, embedded code).
import * as React from 'react'
import { Button, Heading, Hr, Html, Img, Link, Preview, Section, Text } from '@react-email/components'
import { Head, ModoShell, styles } from './_modo-brand'
import type { TemplateEntry } from './registry'

export type AdminBlock =
  | { type: 'heading'; text: string; level?: 1 | 2 | 3 }
  | { type: 'paragraph'; text: string }
  | { type: 'image'; src: string; alt?: string; url?: string }
  | { type: 'button'; text: string; url: string }
  | { type: 'divider' }
  | { type: 'spacer'; size?: 'sm' | 'md' | 'lg' }
  | { type: 'html'; html: string; full?: boolean }

interface AdminBroadcastProps {
  subject?: string
  message?: string
  blocks?: AdminBlock[]
  ctaText?: string | null
  ctaUrl?: string | null
  firstName?: string | null
}

function interpolate(text: string, vars: Record<string, string | undefined>) {
  return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? '')
}

function Paragraphs({ text }: { text: string }) {
  const paras = String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  return (
    <>
      {paras.map((p, i) => (
        <Text key={i} style={styles.text}>
          {p.split('\n').map((line, j, arr) => (
            <React.Fragment key={j}>
              {line}
              {j < arr.length - 1 && <br />}
            </React.Fragment>
          ))}
        </Text>
      ))}
    </>
  )
}

function renderBlock(block: AdminBlock, idx: number, vars: Record<string, string | undefined>) {
  switch (block.type) {
    case 'heading': {
      const size = block.level === 1 ? '26px' : block.level === 3 ? '18px' : '22px'
      return (
        <Heading key={idx} style={{ ...styles.h1, fontSize: size, margin: '18px 0 12px' }}>
          {interpolate(block.text, vars)}
        </Heading>
      )
    }
    case 'paragraph':
      return <Paragraphs key={idx} text={interpolate(block.text, vars)} />
    case 'image': {
      if (!block.src) return null
      const img = (
        <Img
          src={block.src}
          alt={block.alt || ''}
          style={{ maxWidth: '100%', height: 'auto', borderRadius: '12px', margin: '0 auto' }}
        />
      )
      return (
        <Section key={idx} style={{ textAlign: 'center', margin: '18px 0' }}>
          {block.url ? <Link href={interpolate(block.url, vars)}>{img}</Link> : img}
        </Section>
      )
    }
    case 'button': {
      const href = interpolate(block.url || '', vars)
      if (!href) return null
      return (
        <Section key={idx} style={styles.buttonWrap}>
          <Button href={href} style={styles.button}>
            {interpolate(block.text || 'Learn more', vars)}
          </Button>
        </Section>
      )
    }
    case 'divider':
      return <Hr key={idx} style={styles.hr} />
    case 'spacer': {
      const h = block.size === 'lg' ? '32px' : block.size === 'sm' ? '8px' : '18px'
      return <div key={idx} style={{ height: h }} />
    }
    case 'html': {
      const html = interpolate(block.html || '', vars)
      if (!html.trim()) return null
      return <div key={idx} dangerouslySetInnerHTML={{ __html: html }} />
    }
    default:
      return null
  }
}

export const AdminBroadcastEmail = ({
  subject = 'A message from MODO Book',
  message = '',
  blocks = [],
  ctaText,
  ctaUrl,
  firstName,
}: AdminBroadcastProps) => {
  const vars = { first_name: firstName || '' }

  // "Full email" mode — a single embedded-code block replaces the MODO shell.
  const fullBlock = blocks.find((b) => b.type === 'html' && (b as any).full) as
    | { type: 'html'; html: string; full?: boolean }
    | undefined
  if (fullBlock) {
    const raw = interpolate(fullBlock.html || '', vars)
    const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const inner = (bodyMatch ? bodyMatch[1] : raw)
      .replace(/<\/?html[^>]*>/gi, '')
      .replace(/<head[\s\S]*?<\/head>/gi, '')
    return (
      <Html lang="en" dir="ltr">
        <Head />
        <Preview>{subject}</Preview>
        <Section style={{ margin: 0, padding: 0, backgroundColor: '#ffffff' }}>
          <div dangerouslySetInnerHTML={{ __html: inner }} />
        </Section>
      </Html>
    )
  }

  const hasBlocks = blocks.length > 0

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{subject}</Preview>
      <ModoShell preview={null} siteName="MODO Book">
        <Heading style={styles.h1}>{subject}</Heading>
        {firstName && <Text style={styles.text}>Hi {firstName},</Text>}
        {message.trim() ? <Paragraphs text={interpolate(message, vars)} /> : null}
        {hasBlocks && blocks.map((b, i) => renderBlock(b, i, vars))}
        {ctaText && ctaUrl && (
          <>
            <div style={styles.buttonWrap}>
              <Button style={styles.button} href={ctaUrl}>{ctaText}</Button>
            </div>
            <Text style={styles.muted}>
              Or copy this link:{' '}
              <Link href={ctaUrl} style={styles.link}>{ctaUrl}</Link>
            </Text>
          </>
        )}
        <Text style={styles.muted}>— The MODO Book team</Text>
      </ModoShell>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: AdminBroadcastEmail,
  subject: (data) => (data as AdminBroadcastProps).subject || 'A message from MODO Book',
  displayName: 'Admin broadcast',
  previewData: {
    subject: 'A quick update from the MODO team',
    message: 'Hi there,\n\nWe just shipped a new feature we think you\'ll love.',
    blocks: [
      { type: 'button', text: 'See what\'s new', url: 'https://modobook.uk' },
    ],
    firstName: 'Alex',
  },
}

export default AdminBroadcastEmail
