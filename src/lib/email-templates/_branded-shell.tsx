// Practitioner-branded shell for transactional & practitioner-composed emails.
// All CSS must be inline — no Tailwind, no external stylesheets.
import * as React from "react";
import { Body, Container, Head, Hr, Section, Text, Img, Link, Preview } from "@react-email/components";

export type BrandContext = {
  clinicName: string;
  logoUrl?: string | null;
  accentColor?: string | null;
  buttonColor?: string | null;
  buttonTextColor?: string | null;
  textColor?: string | null;
  bgColor?: string | null;
  websiteUrl?: string | null;
  practitionerEmail?: string | null;
};

const DEFAULT_ACCENT = "#b8895a";
const DEFAULT_INK = "#2b2620";
const DEFAULT_BG = "#f5f1ea";

export function brandStyles(b: BrandContext) {
  const accent = b.accentColor || DEFAULT_ACCENT;
  const ink = b.textColor || DEFAULT_INK;
  const cardBg = b.bgColor || "#ffffff";
  const bodyBg = DEFAULT_BG;
  const btnBg = b.buttonColor || accent;
  const btnFg = b.buttonTextColor || "#ffffff";

  return {
    accent,
    ink,
    main: {
      backgroundColor: bodyBg,
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
      color: ink,
      margin: 0,
      padding: "28px 12px",
    } as React.CSSProperties,
    container: {
      maxWidth: "560px",
      margin: "0 auto",
      backgroundColor: cardBg,
      borderRadius: "16px",
      overflow: "hidden" as const,
      border: "1px solid #e6ded0",
    } as React.CSSProperties,
    headerBar: {
      backgroundColor: accent,
      height: "6px",
      lineHeight: "6px",
      fontSize: "0",
    } as React.CSSProperties,
    header: {
      padding: "28px 32px 8px",
      textAlign: "center" as const,
    } as React.CSSProperties,
    logo: {
      maxHeight: "56px",
      width: "auto",
      margin: "0 auto 8px",
      display: "block",
    } as React.CSSProperties,
    clinicName: {
      fontFamily: "'Georgia', 'Times New Roman', serif",
      fontSize: "22px",
      fontWeight: 400,
      letterSpacing: "0.12em",
      color: ink,
      textTransform: "uppercase" as const,
      margin: "6px 0 0",
    } as React.CSSProperties,
    body: { padding: "16px 32px 28px" } as React.CSSProperties,
    h1: {
      fontFamily: "'Georgia', 'Times New Roman', serif",
      fontSize: "22px",
      fontWeight: 400,
      color: ink,
      margin: "6px 0 16px",
      lineHeight: 1.3,
    } as React.CSSProperties,
    text: { fontSize: "15px", color: ink, lineHeight: 1.65, margin: "0 0 14px" } as React.CSSProperties,
    muted: { fontSize: "13px", color: "#7a7266", lineHeight: 1.6, margin: "0 0 10px" } as React.CSSProperties,
    detailCard: {
      backgroundColor: "#faf6ef",
      border: "1px solid #ece3d3",
      borderRadius: "12px",
      padding: "16px 18px",
      margin: "16px 0",
    } as React.CSSProperties,
    detailRow: { fontSize: "14px", color: ink, margin: "0 0 6px", lineHeight: 1.5 } as React.CSSProperties,
    detailLabel: { color: "#7a7266", display: "inline-block", minWidth: "92px" } as React.CSSProperties,
    button: {
      display: "inline-block",
      backgroundColor: btnBg,
      color: btnFg,
      fontSize: "14px",
      fontWeight: 600,
      letterSpacing: "0.06em",
      borderRadius: "999px",
      padding: "13px 26px",
      textDecoration: "none",
    } as React.CSSProperties,
    buttonWrap: { textAlign: "center" as const, margin: "20px 0 12px" } as React.CSSProperties,
    hr: { borderColor: "#ece3d3", margin: "22px 0 16px" } as React.CSSProperties,
    footer: {
      fontSize: "11px",
      color: "#7a7266",
      textAlign: "center" as const,
      lineHeight: 1.7,
      padding: "0 24px 26px",
      margin: 0,
    } as React.CSSProperties,
    footerLink: { color: accent, textDecoration: "underline" } as React.CSSProperties,
  };
}

export function BrandedShell({
  brand,
  preview,
  children,
}: {
  brand: BrandContext;
  preview: string;
  children: React.ReactNode;
}) {
  const s = brandStyles(brand);
  return (
    <>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <div style={s.headerBar} />
          <Section style={s.header}>
            {brand.logoUrl ? (
              <Img src={brand.logoUrl} alt={brand.clinicName} style={s.logo} />
            ) : null}
            <Text style={s.clinicName}>{brand.clinicName}</Text>
          </Section>
          <Section style={s.body}>{children}</Section>
          <Hr style={s.hr} />
          <Text style={s.footer}>
            Sent by {brand.clinicName} via MODO.
            {brand.practitionerEmail ? (
              <>
                <br />
                Reply directly to this email to reach {brand.clinicName} at{" "}
                <Link href={`mailto:${brand.practitionerEmail}`} style={s.footerLink}>
                  {brand.practitionerEmail}
                </Link>
                .
              </>
            ) : null}
          </Text>
        </Container>
      </Body>
    </>
  );
}
