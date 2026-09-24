import * as React from 'react'
import { Body, Button, Container, Head, Img, Link, Section, Text } from '@react-email/components'

export const brand = {
  page: '#eeeae4',
  card: '#faf8f5',
  ink: '#2c2620',
  muted: '#8a8176',
  border: '#e4ddd3',
  soft: '#f4f0ea',
  accent: '#2c2620',
  accentInk: '#faf8f5',
  headerCard: '#f4f0ea',
}

function safeBrandColor(value?: string | null) {
  return value && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : brand.ink
}

export const styles = {
  main: { backgroundColor: brand.page, color: brand.ink, fontFamily: 'Arial, Helvetica, sans-serif', margin: 0, padding: '28px 12px 40px' } as const,
  container: { maxWidth: '560px', margin: '0 auto' } as const,
  contentCard: { backgroundColor: brand.card, border: `1px solid ${brand.border}`, borderRadius: '8px', overflow: 'hidden' } as const,
  content: { padding: '36px 32px 34px' } as const,
  h1: { color: brand.ink, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '28px', fontWeight: 400, lineHeight: '35px', margin: '0 0 16px' } as const,
  h2: { color: brand.ink, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '21px', fontWeight: 400, lineHeight: '28px', margin: '22px 0 10px' } as const,
  text: { color: brand.ink, fontSize: '15px', lineHeight: '24px', margin: '0 0 16px' } as const,
  muted: { color: brand.muted, fontSize: '13px', lineHeight: '21px', margin: '0 0 12px' } as const,
  link: { color: brand.ink, textDecoration: 'underline' } as const,
  button: { display: 'block', boxSizing: 'border-box', width: '100%', backgroundColor: brand.ink, color: brand.card, fontSize: '14px', fontWeight: 700, lineHeight: '20px', borderRadius: '4px', padding: '14px 20px', textAlign: 'center', textDecoration: 'none' } as const,
  buttonWrap: { margin: '24px 0 18px' } as const,
  code: { display: 'block', backgroundColor: brand.soft, color: brand.ink, border: `1px solid ${brand.border}`, borderRadius: '4px', padding: '14px', fontFamily: 'Menlo, Consolas, monospace', fontSize: '15px', letterSpacing: '2px', textAlign: 'center' } as const,
  hr: { borderColor: brand.border, borderWidth: '1px 0 0', margin: '24px 0' } as const,
  footer: { color: brand.muted, fontSize: '11px', lineHeight: '17px', margin: '18px 0 0', textAlign: 'center' } as const,
}

export function EmailHeader({ siteName, logoUrl, brandColor, imageUrl }: { siteName?: string; logoUrl?: string | null; brandColor?: string | null; imageUrl?: string | null }) {
  const accent = safeBrandColor(brandColor)
  return (
    <>
      <Section style={{ padding: '30px 28px 25px', borderBottom: `2px solid ${accent}`, textAlign: 'center' }}>
        {logoUrl ? <Img src={logoUrl} alt={`${siteName || 'Clinic'} logo`} height="54" style={{ display: 'block', width: 'auto', height: '54px', maxWidth: '180px', margin: '0 auto 14px' }} /> : null}
        <Text style={{ margin: 0, color: brand.ink, fontSize: '12px', fontWeight: 700, letterSpacing: '2px', lineHeight: '18px', textTransform: 'uppercase' }}>{siteName || 'MODO'}</Text>
      </Section>
      {imageUrl ? <Section style={{ padding: 0 }}><Img src={imageUrl} alt="" width="560" style={{ display: 'block', width: '100%', height: 'auto', margin: 0 }} /></Section> : null}
    </>
  )
}

export function EmailFooter({ siteName, bookingViaModo = true, unsubscribeUrl, websiteUrl, instagramUrl, directionsUrl }: { siteName?: string; bookingViaModo?: boolean; unsubscribeUrl?: string; websiteUrl?: string | null; instagramUrl?: string | null; directionsUrl?: string | null }) {
  const links = [
    websiteUrl ? { label: 'Website', href: websiteUrl } : null,
    instagramUrl ? { label: 'Instagram', href: instagramUrl } : null,
    directionsUrl ? { label: 'Directions', href: directionsUrl } : null,
    unsubscribeUrl ? { label: 'Unsubscribe', href: unsubscribeUrl } : null,
  ].filter((item): item is { label: string; href: string } => Boolean(item))
  return (
    <>
      <Text style={styles.footer}>{siteName || 'MODO'}{bookingViaModo ? ' · Booking via MODO' : ''}</Text>
      {links.length ? <Text style={{ ...styles.footer, marginTop: '6px' }}>{links.map((item, index) => <React.Fragment key={item.label}>{index ? ' · ' : ''}<Link href={item.href} style={{ color: brand.muted, textDecoration: 'underline' }}>{item.label}</Link></React.Fragment>)}</Text> : null}
    </>
  )
}

export function ModoShell({ children, siteName, logoUrl, brandColor, imageUrl, unsubscribeUrl, websiteUrl, instagramUrl, directionsUrl, platform = false }: { preview?: React.ReactNode; children: React.ReactNode; siteName?: string; logoUrl?: string | null; brandColor?: string | null; imageUrl?: string | null; unsubscribeUrl?: string; websiteUrl?: string | null; instagramUrl?: string | null; directionsUrl?: string | null; platform?: boolean }) {
  return (
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.contentCard}>
          <EmailHeader siteName={siteName} logoUrl={logoUrl} brandColor={brandColor} imageUrl={imageUrl} />
          <Section style={styles.content}>{children}</Section>
        </Section>
        <EmailFooter siteName={siteName} bookingViaModo={!platform} unsubscribeUrl={unsubscribeUrl} websiteUrl={websiteUrl} instagramUrl={instagramUrl} directionsUrl={directionsUrl} />
      </Container>
    </Body>
  )
}

export function brandedButton(brandColor?: string | null) {
  return { ...styles.button, backgroundColor: safeBrandColor(brandColor) }
}

export function outlinedButton(brandColor?: string | null) {
  const accent = safeBrandColor(brandColor)
  return { ...styles.button, backgroundColor: brand.card, color: accent, border: `1px solid ${accent}` }
}

export function DetailRow({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return <tr><td style={{ width: '108px', padding: '14px 0', borderBottom: last ? 'none' : `1px solid ${brand.border}`, color: brand.muted, fontSize: '13px', verticalAlign: 'top' }}>{label}</td><td style={{ padding: '14px 0', borderBottom: last ? 'none' : `1px solid ${brand.border}`, color: brand.ink, fontSize: '14px', lineHeight: '21px', verticalAlign: 'top' }}>{children}</td></tr>
}

export function Notice({ title, children }: { title?: string; children: React.ReactNode }) {
  return <Section style={{ backgroundColor: brand.soft, border: `1px solid ${brand.border}`, borderRadius: '4px', padding: '15px 16px', margin: '18px 0' }}>{title ? <Text style={{ ...styles.muted, color: brand.ink, fontWeight: 700, marginBottom: '4px' }}>{title}</Text> : null}<Text style={{ ...styles.muted, margin: 0 }}>{children}</Text></Section>
}

export function BodyOverride({ text }: { text?: string | null }) {
  const blocks = (text || '').trim().split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  return <>{blocks.map((block, index) => <Text key={index} style={styles.text}>{block.split('\n').map((line, lineIndex, lines) => <React.Fragment key={lineIndex}>{line}{lineIndex < lines.length - 1 ? <br /> : null}</React.Fragment>)}</Text>)}</>
}

export { Button, Head }