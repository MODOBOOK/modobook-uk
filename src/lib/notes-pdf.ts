import { jsPDF } from "jspdf";

export type NotesPdfNote = {
  id: string;
  body: string;
  created_at: string;
  visible_to_patient?: boolean | null;
};

export type NotesPdfInput = {
  clinic?: {
    clinic_name?: string | null;
    full_name?: string | null;
    logo_url?: string | null;
    brand_color?: string | null;
    address?: Record<string, string> | null;
  } | null;
  patient?: { full_name?: string | null; email?: string | null; phone?: string | null } | null;
  notes: NotesPdfNote[];
  title?: string;
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

function fmt(d?: string | null) {
  if (!d) return "";
  try { return new Date(d).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" }); }
  catch { return String(d); }
}

export async function generateNotesPdf({ clinic, patient, notes, title }: NotesPdfInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const [br, bg, bb] = hexToRgb(clinic?.brand_color);
  let y = M + 6;

  doc.setFillColor(br, bg, bb);
  doc.rect(0, 0, W, 6, "F");

  const logo = await loadImageDataUrl(clinic?.logo_url);
  const logoH = 48;
  if (logo) {
    try { doc.addImage(logo, "PNG", M, y, logoH, logoH, undefined, "FAST"); } catch {}
  }
  const left = logo ? M + logoH + 14 : M;
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(20, 20, 20);
  doc.text(clinic?.clinic_name || "Patient notes", left, y + 18);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(110);
  if (clinic?.full_name) doc.text(clinic.full_name, left, y + 34);

  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(br, bg, bb);
  doc.text((title || "PATIENT NOTES").toUpperCase(), W - M, y + 18, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
  doc.text(`Generated: ${fmt(new Date().toISOString())}`, W - M, y + 32, { align: "right" });

  y += Math.max(logoH, 56) + 16;

  // Patient block
  doc.setDrawColor(230).line(M, y, W - M, y);
  y += 16;
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(110);
  doc.text("PATIENT", M, y);
  y += 14;
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(30);
  doc.text(patient?.full_name || "—", M, y);
  y += 14;
  doc.setFontSize(9).setTextColor(110);
  const meta = [patient?.email, patient?.phone].filter(Boolean).join("  ·  ");
  if (meta) { doc.text(meta, M, y); y += 14; }
  y += 8;

  // Notes
  for (const n of notes) {
    const bodyLines = doc.splitTextToSize(n.body || "—", W - M * 2 - 20);
    const cardH = 32 + bodyLines.length * 13 + 12;
    if (y + cardH > H - M - 40) { doc.addPage(); y = M; }

    doc.setDrawColor(230).setFillColor(250, 249, 246);
    doc.roundedRect(M, y, W - M * 2, cardH, 6, 6, "FD");

    // brand tab
    doc.setFillColor(br, bg, bb);
    doc.rect(M, y, 3, cardH, "F");

    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(90);
    doc.text(fmt(n.created_at), M + 12, y + 16);
    if (n.visible_to_patient) {
      const tag = "SHARED WITH PATIENT";
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(br, bg, bb);
      doc.text(tag, W - M - 10, y + 16, { align: "right" });
    } else {
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(160);
      doc.text("PRIVATE", W - M - 10, y + 16, { align: "right" });
    }

    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(30);
    doc.text(bodyLines, M + 12, y + 32);

    y += cardH + 10;
  }

  // Practitioner sign-off
  if (y > H - M - 130) { doc.addPage(); y = M; }
  y = Math.max(y + 12, H - M - 120);
  doc.setDrawColor(220).line(M, y, W - M, y);
  y += 18;
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(30);
  doc.text("Practitioner sign-off", M, y);
  y += 20;
  const colW = (W - M * 2 - 30) / 2;
  doc.setDrawColor(120);
  doc.line(M, y + 40, M + colW, y + 40);
  doc.line(M + colW + 30, y + 40, W - M, y + 40);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
  doc.text("Signature", M, y + 54);
  doc.text("Date", M + colW + 30, y + 54);
  doc.setFontSize(10).setTextColor(40);
  doc.text(clinic?.full_name || "", M, y + 12);
  if (clinic?.clinic_name) { doc.setFontSize(9).setTextColor(110); doc.text(clinic.clinic_name, M, y + 26); }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(150);
    doc.text(
      `${clinic?.clinic_name ?? ""}  ·  ${patient?.full_name ?? ""}  ·  Page ${i} of ${pages}`,
      W / 2, H - 18, { align: "center" },
    );
  }
  return doc;
}
