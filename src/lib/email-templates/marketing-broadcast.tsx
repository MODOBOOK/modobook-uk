// Marketing broadcast email template — renders block JSON inside the MODO
// branded shell with the practitioner's logo & colour. Blocks are safe
// primitives (heading, paragraph, image, button, divider, spacer). No raw
// HTML input is accepted.
import * as React from 'react'
import { Head, Html, Preview, Section, Text, Heading, Img, Button, Hr, Link } from '@react-email/components'
import { ModoShell, styles, brand, brandedButton } from './_modo-brand'
import type { TemplateEntry } from './registry'

export type Block =
  | { type: 'heading'; text: string; level?: 1 | 2 | 3 }
  | { type: 'paragraph'; text: string }
  | { type: 'image'; src: string; alt?: string }
  | { type: 'button'; text: string; url: string }
  | { type: 'divider' }
  | { type: 'spacer'; size?: 'sm' | 'md' | 'lg' }
  | { type: 'html'; html: string; full?: boolean }

export interface MarketingBroadcastData {
  subject?: string
  preheader?: string
  blocks?: Block[]
  clinicName?: string
  logoUrl?: string | null
  brandColor?: string | null
  unsubscribeUrl?: string
  firstName?: string
  last_treatment?: string
  bookingUrl?: string
}


function interpolate(text: string, data: Record<string, string | undefined>): string {
  return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) => data[key] ?? '')
}

function renderBlock(
  block: Block,
  idx: number,
  data: Record<string, string | undefined>,
  brandColor?: string | null,
): React.ReactNode {
  switch (block.type) {
    case 'heading': {
      const size = block.level === 1 ? '26px' : block.level === 3 ? '18px' : '22px'
      return (
        <Heading key={idx} style={{ ...styles.h1, fontSize: size, margin: '18px 0 12px' }}>
          {interpolate(block.text, data)}
        </Heading>
      )
    }
    case 'paragraph': {
      // Preserve the author's formatting: blank lines start a new paragraph,
      // single newlines become line breaks.
      const body = interpolate(block.text, data)
      const paras = String(body || '')
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
      if (paras.length === 0) return null
      return (
        <React.Fragment key={idx}>
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
        </React.Fragment>
      )
    }
    case 'image':
      if (!block.src) return null
      return (
        <Section key={idx} style={{ textAlign: 'center', margin: '18px 0' }}>
          <Img
            src={block.src}
            alt={block.alt || ''}
            style={{ maxWidth: '100%', height: 'auto', borderRadius: '12px', margin: '0 auto' }}
          />
        </Section>
      )
    case 'button': {
      const href = interpolate(block.url || '', data)
      if (!href) return null
      return (
        <Section key={idx} style={styles.buttonWrap}>
          <Button href={href} style={brandedButton(brandColor)}>
            {interpolate(block.text || 'Learn more', data)}
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
      const html = interpolate(block.html || '', data)
      if (!html.trim()) return null
      return <div key={idx} dangerouslySetInnerHTML={{ __html: html }} />
    }
    default:
      return null
  }
}

export function MarketingBroadcastEmail(data: MarketingBroadcastData) {
  const {
    subject = 'A note from your clinic',
    preheader = '',
    blocks = [],
    clinicName = 'MODO',
    logoUrl,
    brandColor,
    unsubscribeUrl = 'https://modobook.uk/unsubscribe',
    firstName = '',
    last_treatment = '',
    bookingUrl = '',
  } = data
  const vars = {
    first_name: firstName,
    clinic_name: clinicName,
    last_treatment,
    booking_url: bookingUrl,
    unsubscribe_url: unsubscribeUrl,
  }
  // "Full email" mode: a single embedded-code block replaces the MODO shell.
  const fullBlock = blocks.find((b) => b.type === 'html' && b.full) as
    | { type: 'html'; html: string; full?: boolean }
    | undefined
  if (fullBlock) {
    const raw = interpolate(fullBlock.html || '', vars)
    // Keep only the body contents so the output stays a single valid document.
    const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const inner = (bodyMatch ? bodyMatch[1] : raw)
      .replace(/<\/?html[^>]*>/gi, '')
      .replace(/<head[\s\S]*?<\/head>/gi, '')
    return (
      <Html>
        <Head />
        <Preview>{preheader || subject}</Preview>
        <Section style={{ margin: 0, padding: 0, backgroundColor: '#ffffff' }}>
          <div dangerouslySetInnerHTML={{ __html: inner }} />
          <Text style={{ ...styles.footer, textAlign: 'center', marginTop: 20 }}>
            You&rsquo;re receiving this because you opted in to marketing emails from {clinicName}.{' '}
            <Link href={unsubscribeUrl} style={{ color: brand.muted, textDecoration: 'underline' }}>
              Unsubscribe
            </Link>
          </Text>
        </Section>
      </Html>
    )
  }

  return (
    <Html>
      <Head />
      <Preview>{preheader || subject}</Preview>
      <ModoShell preview={preheader} siteName={clinicName} logoUrl={logoUrl} brandColor={brandColor}>
        {blocks.length === 0 ? (
          <Text style={styles.text}>(no content)</Text>
        ) : (
          blocks.map((b, i) => renderBlock(b, i, vars, brandColor))
        )}
        <Hr style={styles.hr} />
        <Text style={{ ...styles.footer, marginBottom: 8 }}>
          You&rsquo;re receiving this because you opted in to marketing emails from {clinicName}.
        </Text>
        <Text style={styles.footer}>
          <Link href={unsubscribeUrl} style={{ color: brand.muted, textDecoration: 'underline' }}>
            Unsubscribe
          </Link>
        </Text>
      </ModoShell>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: MarketingBroadcastEmail,
  subject: (data) => (data as MarketingBroadcastData).subject || 'A note from your clinic',
  displayName: 'Marketing broadcast',
  previewData: {
    subject: 'A little update from us',
    preheader: 'Something new we thought you\'d like',
    clinicName: 'Sample Clinic',
    firstName: 'Alex',
    blocks: [
      { type: 'heading', text: 'Hi {{first_name}}!' },
      { type: 'paragraph', text: 'We wanted to share a quick update...' },
      { type: 'button', text: 'Book now', url: 'https://modobook.uk' },
    ],
  },
}
