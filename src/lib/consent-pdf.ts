import { jsPDF } from "jspdf";

export type ConsentSectionLike = { title: string; body?: string; bullets?: string[] };

export type ConsentPdfInput = {
  clinic?: {
    clinic_name?: string | null;
    full_name?: string | null;
    logo_url?: string | null;
    brand_color?: string | null;
    address?: any;
    email?: string | null;
    phone?: string | null;
  } | null;
  patient?: { full_name?: string | null; email?: string | null; phone?: string | null; dob?: string | null } | null;
  consent: {
    template_name?: string | null;
    template_summary?: string | null;
    template_sections?: ConsentSectionLike[] | null;
    template_body?: string | null;
    status?: string | null;
    signed_at?: string | null;
    signature_name?: string | null;
    signature_data?: string | null;
    created_at?: string | null;
  };
};

function hexToRgb(hex?: string | null): [number, number, number] {
  if (!hex) return [40, 40, 40];
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function loadImageDataUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

function fmtDateTime(d?: string | null) {
  if (!d) return "";
  try { return new Date(d).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" }); }
  catch { return String(d); }
}

/** Render one or many consents into a single PDF. Each consent starts on its own page. */
export async function generateConsentPdf(inputs: ConsentPdfInput | ConsentPdfInput[]): Promise<jsPDF> {
  const list = Array.isArray(inputs) ? inputs : [inputs];
  if (list.length === 0) throw new Error("No consents to export");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const CW = W - M * 2;

  // Preload each clinic logo once (common case: all same clinic)
  const logoCache = new Map<string, string | null>();
  async function logoFor(url?: string | null) {
    const key = url || "";
    if (logoCache.has(key)) return logoCache.get(key)!;
    const d = await loadImageDataUrl(url);
    logoCache.set(key, d);
    return d;
  }

  for (let i = 0; i < list.length; i++) {
    const { clinic, patient, consent } = list[i];
    const [br, bg, bb] = hexToRgb(clinic?.brand_color);
    if (i > 0) doc.addPage();
    let y = M;

    doc.setFillColor(br, bg, bb).rect(0, 0, W, 4, "F");

    const logo = await logoFor(clinic?.logo_url);
    if (logo) { try { doc.addImage(logo, "PNG", M, y, 48, 48, undefined, "FAST"); } catch {} }
    const left = logo ? M + 62 : M;
    doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(20);
    doc.text(clinic?.clinic_name || "Consent form", left, y + 20);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
    const sub = [clinic?.full_name, clinic?.email, clinic?.phone].filter(Boolean).join("  ·  ");
    if (sub) doc.text(sub, left, y + 36);

    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(br, bg, bb);
    doc.text("CONSENT FORM", W - M, y + 20, { align: "right" });
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(120);
    doc.text(`Generated ${fmtDateTime(new Date().toISOString())}`, W - M, y + 34, { align: "right" });

    y += 60;
    doc.setDrawColor(220).line(M, y, W - M, y);
    y += 18;

    // Title + status
    doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(20);
    const titleLines = doc.splitTextToSize(consent.template_name || "Consent form", CW - 120);
    doc.text(titleLines, M, y);
    const statusColor: [number, number, number] = consent.status === "signed" ? [16, 122, 82] : [180, 130, 20];
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...statusColor);
    doc.text((consent.status || "pending").toUpperCase(), W - M, y, { align: "right" });
    y += titleLines.length * 20;

    // Patient block
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60);
    const idBits = [
      patient?.full_name && `Patient: ${patient.full_name}`,
      patient?.dob && `DOB: ${patient.dob}`,
      patient?.email,
      patient?.phone,
    ].filter(Boolean) as string[];
    if (idBits.length) {
      doc.text(idBits.join("  ·  "), M, y);
      y += 16;
    }
    doc.setFontSize(9).setTextColor(120);
    if (consent.signed_at) doc.text(`Signed ${fmtDateTime(consent.signed_at)}${consent.signature_name ? ` by ${consent.signature_name}` : ""}`, M, y);
    else if (consent.created_at) doc.text(`Sent ${fmtDateTime(consent.created_at)} · awaiting signature`, M, y);
    y += 20;

    function ensure(space: number) {
      if (y + space > H - M - 140) { doc.addPage(); y = M; }
    }

    // Summary card
    if (consent.template_summary) {
      const lines = doc.splitTextToSize(consent.template_summary, CW - 24);
      const h = 16 + lines.length * 12;
      ensure(h + 6);
      doc.setDrawColor(210, 210, 210).setFillColor(248, 246, 240);
      doc.roundedRect(M, y, CW, h, 6, 6, "FD");
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(50);
      doc.text(lines, M + 12, y + 16);
      y += h + 14;
    }

    // Sections or fallback body
    if (consent.template_sections && consent.template_sections.length > 0) {
      for (const s of consent.template_sections) {
        ensure(30);
        doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(br, bg, bb);
        doc.text(s.title || "", M, y);
        y += 14;
        if (s.body) {
          doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(40);
          const lines = doc.splitTextToSize(s.body, CW);
          for (const l of lines) { ensure(14); doc.text(l, M, y); y += 13; }
        }
        if (Array.isArray(s.bullets) && s.bullets.length) {
          doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(40);
          for (const b of s.bullets) {
            const lines = doc.splitTextToSize(`•  ${b}`, CW - 12);
            for (const l of lines) { ensure(14); doc.text(l, M + 6, y); y += 13; }
          }
        }
        y += 6;
      }
    } else if (consent.template_body) {
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(40);
      const lines = doc.splitTextToSize(consent.template_body, CW);
      for (const l of lines) { ensure(14); doc.text(l, M, y); y += 13; }
    }

    // Signature block
    ensure(140);
    y = Math.max(y + 16, H - M - 130);
    doc.setDrawColor(220).line(M, y, W - M, y);
    y += 18;
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(30);
    doc.text("Patient signature", M, y);
    y += 12;

    const sigBoxW = CW * 0.55;
    const sigBoxH = 70;
    doc.setDrawColor(200).roundedRect(M, y, sigBoxW, sigBoxH, 4, 4);
    if (consent.signature_data && String(consent.signature_data).startsWith("data:image")) {
      try { doc.addImage(consent.signature_data, "PNG", M + 6, y + 6, sigBoxW - 12, sigBoxH - 12, undefined, "FAST"); } catch {}
    } else if (consent.signature_name) {
      doc.setFont("times", "italic").setFontSize(20).setTextColor(30);
      doc.text(consent.signature_name, M + 12, y + 42);
    } else {
      doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(160);
      doc.text("(unsigned)", M + 12, y + 40);
    }

    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(120);
    doc.text("Signature", M, y + sigBoxH + 12);

    const rightX = M + sigBoxW + 20;
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(90);
    doc.text("SIGNED BY", rightX, y + 12);
    doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(30);
    doc.text(consent.signature_name || patient?.full_name || "—", rightX, y + 28);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(90);
    doc.text("DATE", rightX, y + 46);
    doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(30);
    doc.text(consent.signed_at ? fmtDateTime(consent.signed_at) : "—", rightX, y + 62);
  }

  // Footer page numbers
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8).setTextColor(150);
    doc.text(`Confidential  ·  Page ${p} of ${pages}`, W / 2, H - 18, { align: "center" });
  }
  return doc;
}
