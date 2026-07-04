// Shared MODO branding for auth emails. Keep pure inline styles — email clients
// don't support Tailwind or external CSS.
import * as React from 'react'
import { Body, Container, Head, Hr, Img, Section, Text } from '@react-email/components'

export const brand = {
  bg: '#ffffff',
  card: '#f5f1ea',
  ink: '#2b2620',
  muted: '#7a7266',
  accent: '#b8895a',
  accentInk: '#ffffff',
  border: '#e6ded0',
  soft: '#efe7d8',
}

export const styles = {
  main: {
    backgroundColor: brand.bg,
    fontFamily:
      "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    color: brand.ink,
    margin: 0,
    padding: '32px 12px',
  } as const,
  container: {
    maxWidth: '520px',
    margin: '0 auto',
    backgroundColor: brand.card,
    borderRadius: '18px',
    padding: '40px 36px',
    border: `1px solid ${brand.border}`,
  } as const,
  wordmark: {
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: '28px',
    letterSpacing: '0.32em',
    color: brand.ink,
    textAlign: 'center' as const,
    margin: '0 0 4px',
    fontWeight: 400,
  } as const,
  tagline: {
    fontSize: '10px',
    letterSpacing: '0.35em',
    textTransform: 'uppercase' as const,
    color: brand.accent,
    textAlign: 'center' as const,
    margin: '0 0 28px',
  } as const,
  h1: {
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: '24px',
    fontWeight: 400,
    color: brand.ink,
    margin: '8px 0 16px',
    lineHeight: 1.25,
  } as const,
  text: {
    fontSize: '15px',
    color: brand.ink,
    lineHeight: 1.6,
    margin: '0 0 18px',
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
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    borderRadius: '999px',
    padding: '14px 28px',
    textDecoration: 'none',
  } as const,
  buttonWrap: { textAlign: 'center' as const, margin: '26px 0 22px' } as const,
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
  hr: { borderColor: brand.border, margin: '28px 0 18px' } as const,
  footer: {
    fontSize: '11px',
    color: brand.muted,
    textAlign: 'center' as const,
    lineHeight: 1.6,
    margin: 0,
  } as const,
}

export function ModoShell({
  preview,
  children,
  siteName,
}: {
  preview: React.ReactNode
  children: React.ReactNode
  siteName?: string
}) {
  const _preview = preview // silence unused warning; Preview is set by caller
  void _preview
  return (
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section>
          <Text style={styles.wordmark}>MODO</Text>
          <Text style={styles.tagline}>The Modern Aesthetics Studio</Text>
        </Section>
        {children}
        <Hr style={styles.hr} />
        <Text style={styles.footer}>
          You&rsquo;re receiving this email from {siteName || 'MODO'}.
          <br />
          If this wasn&rsquo;t you, you can safely ignore it.
        </Text>
      </Container>
    </Body>
  )
}

export { Head }
