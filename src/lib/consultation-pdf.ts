import { jsPDF } from "jspdf";

export type ConsultationPdfInput = {
  clinic?: {
    clinic_name?: string | null;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: Record<string, string> | null;
    logo_url?: string | null;
    brand_color?: string | null;
  } | null;
  consultation: any;
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
  } catch {
    return null;
  }
}

function fmtDate(d?: string | null) {
  if (!d) return "";
  try { return new Date(d).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" }); } catch { return String(d); }
}

function joinAddress(a?: Record<string, string> | null): string[] {
  if (!a) return [];
  const parts = [a.line1, a.line2, a.city, a.postcode, a.country].filter(Boolean) as string[];
  return parts;
}

export async function generateConsultationPdf({ clinic, consultation }: ConsultationPdfInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const [br, bg, bb] = hexToRgb(clinic?.brand_color);
  let y = M;

  const ensureSpace = (need: number) => {
    if (y + need > H - M) { doc.addPage(); y = M; }
  };

  const sectionTitle = (label: string) => {
    ensureSpace(36);
    doc.setFillColor(br, bg, bb);
    doc.rect(M, y, 3, 16, "F");
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(30, 30, 30);
    doc.text(label, M + 10, y + 12);
    y += 22;
    doc.setDrawColor(230).line(M, y, W - M, y);
    y += 12;
  };

  const paragraph = (text: string, opts?: { size?: number; color?: [number, number, number]; indent?: number }) => {
    if (!text) return;
    const size = opts?.size ?? 10;
    const color = opts?.color ?? [40, 40, 40];
    const indent = opts?.indent ?? 0;
    doc.setFont("helvetica", "normal").setFontSize(size).setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, W - M * 2 - indent);
    for (const line of lines) {
      ensureSpace(size + 4);
      doc.text(line, M + indent, y);
      y += size + 4;
    }
  };

  const kv = (label: string, value: string) => {
    ensureSpace(14);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(110);
    doc.text(label.toUpperCase(), M, y);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(30);
    doc.text(value || "—", M + 130, y);
    y += 14;
  };

  // ===== Header band =====
  doc.setFillColor(br, bg, bb);
  doc.rect(0, 0, W, 6, "F");
  y = M + 6;

  const logoData = await loadImageDataUrl(clinic?.logo_url);
  const logoH = 50;
  if (logoData) {
    try { doc.addImage(logoData, "PNG", M, y, logoH, logoH, undefined, "FAST"); } catch {}
  }
  const headerLeft = logoData ? M + logoH + 14 : M;
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(20, 20, 20);
  doc.text(clinic?.clinic_name || "Consultation record", headerLeft, y + 18);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(110);
  if (clinic?.full_name) doc.text(clinic.full_name, headerLeft, y + 34);
  const addrLines = joinAddress(clinic?.address);
  if (addrLines.length) doc.text(addrLines.join(", "), headerLeft, y + 48);

  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(br, bg, bb);
  doc.text("CONSULTATION", W - M, y + 18, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
  doc.text(`Date: ${fmtDate(consultation?.created_at)}`, W - M, y + 32, { align: "right" });
  if (consultation?.completed_at) doc.text(`Completed: ${fmtDate(consultation.completed_at)}`, W - M, y + 46, { align: "right" });
  doc.text(`Ref: ${String(consultation?.id ?? "").slice(0, 8)}`, W - M, y + 60, { align: "right" });

  y += Math.max(logoH, 60) + 20;

  // ===== Patient =====
  sectionTitle("Patient");
  kv("Name", consultation?.patient_name ?? "");
  if (consultation?.patient_email) kv("Email", consultation.patient_email);
  if (consultation?.patient_phone) kv("Phone", consultation.patient_phone);
  y += 6;

  // ===== Medical =====
  const medical = consultation?.medical ?? {};
  const answers: Record<string, boolean> = medical?.answers ?? {};
  const ticked = Object.entries(answers).filter(([, v]) => v).map(([k]) => k);
  sectionTitle("Medical history");
  if (ticked.length === 0 && !medical?.notes) {
    paragraph("No items flagged.", { color: [120, 120, 120] });
  } else {
    if (ticked.length) paragraph(ticked.map((t) => `• ${t}`).join("\n"));
    if (medical?.notes) { y += 4; paragraph(`Notes: ${medical.notes}`); }
  }

  // ===== Concerns =====
  const concerns = consultation?.concerns ?? {};
  sectionTitle("Concerns");
  const cs: string[] = concerns?.selected ?? [];
  if (cs.length) paragraph(cs.map((c) => `• ${c}`).join("\n"));
  if (concerns?.notes) { y += 4; paragraph(`Patient's own words: ${concerns.notes}`); }
  if (!cs.length && !concerns?.notes) paragraph("—", { color: [120, 120, 120] });

  // ===== Assessment =====
  const assessment = consultation?.assessment ?? {};
  sectionTitle("Clinical assessment");
  paragraph(assessment?.notes || "—", assessment?.notes ? undefined : { color: [120, 120, 120] });

  // ===== Before photos =====
  const beforePhotos: string[] = (consultation?.before_photos ?? []).map((p: any) => typeof p === "string" ? p : p?.url).filter(Boolean);
  if (beforePhotos.length) {
    sectionTitle("Before photos");
    await renderPhotoGrid(doc, beforePhotos, M, W, () => y, (v) => { y = v; }, ensureSpace);
  }

  // ===== Treatment plan =====
  const plan = consultation?.treatment_plan ?? {};
  sectionTitle("Treatment plan");
  paragraph(plan?.text || "—", plan?.text ? undefined : { color: [120, 120, 120] });
  if (plan?.price || plan?.followup_weeks) {
    y += 4;
    if (plan?.price) kv("Estimated price", `£${Number(plan.price).toFixed(2)}`);
    if (plan?.followup_weeks) kv("Follow-up", `${plan.followup_weeks} weeks`);
  }

  // ===== Treatment performed =====
  const log = consultation?.treatment_log ?? {};
  const products: any[] = log?.products ?? [];
  if (products.length || log?.aftercare) {
    sectionTitle("Treatment performed");
    if (products.length) {
      // simple table
      ensureSpace(20);
      doc.setFillColor(248, 246, 242).rect(M, y - 4, W - M * 2, 20, "F");
      doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(110);
      doc.text("PRODUCT", M + 8, y + 9);
      doc.text("AREA", M + 200, y + 9);
      doc.text("QTY", W - M - 120, y + 9, { align: "right" });
      doc.text("PRICE", W - M - 10, y + 9, { align: "right" });
      y += 24;
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(30);
      for (const p of products) {
        ensureSpace(16);
        const label = [p.name, p.strength, p.batch ? `batch ${p.batch}` : null].filter(Boolean).join(" · ") || "—";
        doc.text(doc.splitTextToSize(label, 180), M + 8, y);
        doc.text(String(p.area ?? "—"), M + 200, y);
        doc.text(String(p.quantity ?? "1"), W - M - 120, y, { align: "right" });
        const price = Number(p.price ?? 0);
        doc.text(price ? `£${price.toFixed(2)}` : "—", W - M - 10, y, { align: "right" });
        y += 16;
        doc.setDrawColor(238).line(M, y - 4, W - M, y - 4);
      }
      y += 6;
    }
    if (log?.aftercare) { paragraph(`Aftercare advice: ${log.aftercare}`); }
  }

  // ===== After photos =====
  const afterPhotos: string[] = (consultation?.after_photos ?? []).map((p: any) => typeof p === "string" ? p : p?.url).filter(Boolean);
  if (afterPhotos.length) {
    sectionTitle("After photos");
    await renderPhotoGrid(doc, afterPhotos, M, W, () => y, (v) => { y = v; }, ensureSpace);
  }

  // ===== Consent =====
  const consent = consultation?.consent ?? {};
  sectionTitle("Consent");
  if (consent?.body) paragraph(consent.body);
  const ticks = Object.entries(consent).filter(([k, v]) => v === true && !["signature"].includes(k));
  if (ticks.length) {
    y += 4;
    paragraph(ticks.map(([k]) => `✓ ${k}`).join("\n"), { size: 9, color: [80, 80, 80] });
  }
  if (consent?.signature) {
    ensureSpace(80);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(110);
    doc.text("PATIENT SIGNATURE", M, y);
    y += 6;
    try { doc.addImage(consent.signature, "PNG", M, y, 180, 50); } catch {}
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(80);
    doc.text(`${consent.signer_name ?? consultation.patient_name ?? ""}${consent.signed_at ? " · " + fmtDate(consent.signed_at) : ""}`, M, y + 62);
    y += 78;
  }

  // ===== Invoice summary (if any) =====
  const invoice = consultation?.invoice ?? {};
  const invItems: any[] = Array.isArray(invoice?.items) ? invoice.items : [];
  if (invItems.length || invoice?.amount) {
    sectionTitle("Invoice");
    const subtotal = invItems.length
      ? invItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0)
      : Number(invoice?.amount ?? 0);
    if (invItems.length) {
      for (const it of invItems) {
        ensureSpace(14);
        const line = `${it.description || "—"}  ×${it.qty ?? 1}`;
        doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(40);
        doc.text(line, M, y);
        doc.text(`£${((Number(it.qty) || 0) * (Number(it.unitPrice) || 0)).toFixed(2)}`, W - M, y, { align: "right" });
        y += 14;
      }
    }
    ensureSpace(20);
    doc.setDrawColor(220).line(M, y, W - M, y); y += 14;
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(30);
    doc.text("Total", M, y);
    doc.text(`£${subtotal.toFixed(2)}`, W - M, y, { align: "right" });
    y += 16;
  }

  // ===== Practitioner sign-off =====
  ensureSpace(120);
  y = Math.max(y + 12, H - M - 130);
  doc.setDrawColor(220).line(M, y, W - M, y);
  y += 18;
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(30);
  doc.text("Practitioner sign-off", M, y);
  y += 20;

  const colW = (W - M * 2 - 30) / 2;
  // Signature line
  doc.setDrawColor(120);
  doc.line(M, y + 40, M + colW, y + 40);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
  doc.text("Signature", M, y + 54);

  doc.line(M + colW + 30, y + 40, W - M, y + 40);
  doc.text("Date", M + colW + 30, y + 54);

  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(40);
  doc.text(clinic?.full_name || "", M, y + 12);
  doc.setFontSize(9).setTextColor(110);
  if (clinic?.clinic_name) doc.text(clinic.clinic_name, M, y + 26);

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(150);
    doc.text(
      `${clinic?.clinic_name ?? ""}  ·  ${consultation?.patient_name ?? ""}  ·  Page ${i} of ${pageCount}`,
      W / 2,
      H - 18,
      { align: "center" },
    );
  }

  return doc;
}

async function renderPhotoGrid(
  doc: jsPDF,
  urls: string[],
  M: number,
  W: number,
  getY: () => number,
  setY: (v: number) => void,
  ensureSpace: (n: number) => void,
) {
  const cols = 2;
  const gap = 12;
  const cellW = (W - M * 2 - gap * (cols - 1)) / cols;
  const cellH = cellW * 0.75;
  let col = 0;
  let y = getY();
  for (const url of urls) {
    const data = await loadImageDataUrl(url);
    if (!data) continue;
    if (col === 0) ensureSpace(cellH + 8);
    y = getY();
    const x = M + col * (cellW + gap);
    try { doc.addImage(data, "JPEG", x, y, cellW, cellH, undefined, "FAST"); } catch {
      try { doc.addImage(data, "PNG", x, y, cellW, cellH, undefined, "FAST"); } catch {}
    }
    col += 1;
    if (col >= cols) {
      col = 0;
      setY(y + cellH + 10);
    }
  }
  if (col !== 0) setY(getY() + cellH + 10);
}
