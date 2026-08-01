// Shared email shell. Clean, minimal layout inspired by premium clinic emails:
// a coloured header card holding the practitioner's logo (or clinic name
// wordmark) at the top, then a white content card underneath, on a soft page
// background. Keeps pure inline styles — email clients don't support Tailwind.
import * as React from 'react'
import { Body, Container, Head, Hr, Img, Section, Text } from '@react-email/components'
import modoLogo from '@/assets/modo-logo.png.asset.json'

const MODO_LOGO_URL = modoLogo.url

/** Fallback palette (used when no practitioner brand colour is supplied). */
export const brand = {
  page: '#faf7f2',
  card: '#ffffff',
  headerCard: '#f0ebe3',
  ink: '#3a3530',
  muted: '#7a7268',
  accent: '#8b7355',
  accentInk: '#faf7f2',
  border: '#ece6db',
  soft: '#f4efe7',
}

/** Pick a readable foreground colour for a given hex background. */
function readableInk(hex?: string | null): string {
  if (!hex) return brand.ink
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim())
  if (!m) return brand.ink
  const int = parseInt(m[1], 16)
  const r = (int >> 16) & 0xff
  const g = (int >> 8) & 0xff
  const b = int & 0xff
  // Perceived luminance (sRGB) — bright bg → dark ink, dark bg → light ink.
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return lum > 170 ? '#2b2620' : '#ffffff'
}

/** Lighten a hex colour towards white by `amount` (0–1). Used so a logo sits
 *  on a soft tint of the clinic's brand colour instead of a dark block. */
function tint(hex?: string | null, amount = 0.88): string | null {
  if (!hex) return null
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim())
  if (!m) return null
  const int = parseInt(m[1], 16)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  const r = mix((int >> 16) & 0xff)
  const g = mix((int >> 8) & 0xff)
  const b = mix(int & 0xff)
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export const styles = {
  main: {
    backgroundColor: brand.page,
    fontFamily:
      "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    color: brand.ink,
    margin: 0,
    padding: '28px 12px 40px',
  } as const,
  container: {
    maxWidth: '560px',
    margin: '0 auto',
  } as const,
  headerCard: {
    borderRadius: '14px',
    padding: '36px 24px',
    textAlign: 'center' as const,
    margin: '0 0 20px',
  } as const,
  contentCard: {
    backgroundColor: brand.card,
    borderRadius: '14px',
    padding: '36px 32px',
    border: `1px solid ${brand.border}`,
  } as const,
  wordmark: {
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: '22px',
    letterSpacing: '0.28em',
    textAlign: 'center' as const,
    margin: 0,
    fontWeight: 400,
  } as const,
  h1: {
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: '22px',
    fontWeight: 400,
    color: brand.ink,
    margin: '0 0 18px',
    lineHeight: 1.25,
  } as const,
  text: {
    fontSize: '15px',
    color: brand.ink,
    lineHeight: 1.65,
    margin: '0 0 16px',
  } as const,
  muted: {
    fontSize: '13px',
    color: brand.muted,
    lineHeight: 1.6,
    margin: '0 0 12px',
  } as const,
  link: { color: brand.accent, textDecoration: 'underline' } as const,
  button: {
    display: 'inline-block',
    backgroundColor: brand.ink,
    color: brand.accentInk,
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    borderRadius: '999px',
    padding: '13px 26px',
    textDecoration: 'none',
  } as const,
  buttonWrap: { textAlign: 'center' as const, margin: '22px 0 18px' } as const,
  code: {
    display: 'inline-block',
    backgroundColor: brand.soft,
    color: brand.ink,
    border: `1px solid ${brand.border}`,
    borderRadius: '10px',
    padding: '10px 14px',
    fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace",
    fontSize: '13px',
    wordBreak: 'break-all' as const,
  } as const,
  hr: { borderColor: brand.border, margin: '24px 0 16px' } as const,
  footer: {
    fontSize: '11px',
    color: brand.muted,
    textAlign: 'center' as const,
    lineHeight: 1.6,
    margin: '18px 0 0',
  } as const,
}

export function ModoShell({
  preview,
  children,
  siteName,
  logoUrl,
  brandColor,
}: {
  preview: React.ReactNode
  children: React.ReactNode
  siteName?: string
  /** Practitioner logo URL — replaces the wordmark when provided. */
  logoUrl?: string | null
  /** Practitioner brand colour — used as the header card background. */
  brandColor?: string | null
}) {
  const _preview = preview
  void _preview

  const headerBg = brandColor?.trim() || brand.headerCard
  const headerInk = readableInk(headerBg)
  const modoFallback = `https://modobook.uk${MODO_LOGO_URL}`

  return (
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={{ ...styles.headerCard, backgroundColor: headerBg }}>
          {logoUrl ? (
            <Img
              src={logoUrl}
              alt={siteName || 'Clinic logo'}
              height="72"
              style={{ height: '72px', width: 'auto', margin: '0 auto', display: 'inline-block' }}
            />
          ) : siteName ? (
            <Text style={{ ...styles.wordmark, color: headerInk }}>{siteName.toUpperCase()}</Text>
          ) : (
            <Img
              src={modoFallback}
              alt="MODO"
              height="64"
              style={{ height: '64px', width: 'auto', margin: '0 auto', display: 'inline-block' }}
            />
          )}
        </Section>

        <Section style={styles.contentCard}>{children}</Section>

        <Text style={styles.footer}>
          Sent by {siteName || 'MODO'}.
        </Text>
      </Container>
    </Body>
  )
}

/** Merge the base button style with a practitioner brand colour when set. */
export function brandedButton(brandColor?: string | null) {
  if (!brandColor) return styles.button
  return { ...styles.button, backgroundColor: brandColor, color: readableInk(brandColor) }
}

/** Render a practitioner-authored body override as paragraphs.
 *  Blank-line-separated blocks become <Text> paragraphs; single line breaks
 *  become <br />. Returns null when no override is provided. */
export function BodyOverride({ text }: { text?: string | null }) {
  const trimmed = (text || '').trim()
  if (!trimmed) return null
  const blocks = trimmed.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  return (
    <>
      {blocks.map((block, i) => (
        <Text key={i} style={styles.text}>
          {block.split('\n').map((line, j, arr) => (
            <React.Fragment key={j}>
              {line}
              {j < arr.length - 1 ? <br /> : null}
            </React.Fragment>
          ))}
        </Text>
      ))}
    </>
  )
}

export { Head }
