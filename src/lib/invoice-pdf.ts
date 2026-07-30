import { jsPDF } from "jspdf";

export type InvoiceLineItem = {
  description: string;
  qty?: number;
  unitPrice: number; // in major units (£)
};

export type InvoiceBank = {
  bankName?: string | null;
  accountName?: string | null;
  sortCode?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  swift?: string | null;
  paymentReference?: string | null;
};

export type InvoiceData = {
  clinic: string;
  practitioner?: string;
  clinicAddress?: string[]; // each line
  clinicEmail?: string | null;
  clinicPhone?: string | null;
  vatNumber?: string | null;
  companyNumber?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null; // hex like #884444
  patientName?: string;
  patientEmail?: string;
  date: string;
  items?: InvoiceLineItem[];
  /** Fallback when no items supplied */
  amount: number;
  notes?: string;
  footerNotes?: string | null;
  paymentLink?: string;
  reference?: string;
  bank?: InvoiceBank | null;
  showBank?: boolean;
  /** Platform/processing fees added when paying by the Stripe link (in pence) */
  feeCents?: number | null;
  feeLabel?: string | null;
};

function hexToRgb(hex?: string | null): [number, number, number] {
  if (!hex) return [30, 30, 30];
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map(c => c + c).join("") : m, 16);
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

export async function generateInvoicePdf(d: InvoiceData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const [br, bg, bb] = hexToRgb(d.brandColor);

  // Brand color band
  doc.setFillColor(br, bg, bb);
  doc.rect(0, 0, W, 6, "F");

  let y = M + 6;

  // Logo
  const logoData = await loadImageDataUrl(d.logoUrl);
  const logoH = 48;
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", M, y, logoH, logoH, undefined, "FAST");
    } catch {
      // ignore image failures, keep going
    }
  }

  const headerLeft = logoData ? M + logoH + 14 : M;
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(20, 20, 20);
  doc.text(d.clinic || "Invoice", headerLeft, y + 18);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(110);
  if (d.practitioner) doc.text(d.practitioner, headerLeft, y + 34);

  // Right side meta
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(br, bg, bb);
  doc.text("INVOICE", W - M, y + 18, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
  if (d.reference) doc.text(`Ref: ${d.reference}`, W - M, y + 32, { align: "right" });
  doc.text(`Date: ${d.date}`, W - M, y + 46, { align: "right" });

  y += Math.max(logoH, 56) + 14;

  // From / To columns
  doc.setDrawColor(230).line(M, y, W - M, y);
  y += 18;
  doc.setFontSize(9).setTextColor(140);
  doc.text("FROM", M, y);
  doc.text("BILLED TO", W / 2, y);
  y += 14;
  doc.setFontSize(10).setTextColor(40);
  const fromLines: string[] = [];
  if (d.clinic) fromLines.push(d.clinic);
  (d.clinicAddress ?? []).forEach((l) => l && fromLines.push(l));
  if (d.clinicEmail) fromLines.push(d.clinicEmail);
  if (d.clinicPhone) fromLines.push(d.clinicPhone);
  if (d.vatNumber) fromLines.push(`VAT: ${d.vatNumber}`);
  if (d.companyNumber) fromLines.push(`Co. No: ${d.companyNumber}`);
  fromLines.forEach((line, i) => doc.text(line, M, y + i * 12));

  const toLines: string[] = [];
  toLines.push(d.patientName || "—");
  if (d.patientEmail) toLines.push(d.patientEmail);
  toLines.forEach((line, i) => doc.text(line, W / 2, y + i * 12));

  y += Math.max(fromLines.length, toLines.length) * 12 + 20;

  // Items table
  doc.setDrawColor(220).setFillColor(248, 246, 242);
  doc.rect(M, y - 4, W - M * 2, 22, "F");
  doc.setFontSize(9).setTextColor(110);
  doc.text("DESCRIPTION", M + 10, y + 11);
  doc.text("QTY", W - M - 200, y + 11, { align: "right" });
  doc.text("UNIT", W - M - 110, y + 11, { align: "right" });
  doc.text("TOTAL", W - M - 10, y + 11, { align: "right" });
  y += 28;

  doc.setFontSize(10).setTextColor(30);
  const items: InvoiceLineItem[] = d.items && d.items.length > 0
    ? d.items
    : [{ description: d.notes || "Treatment", qty: 1, unitPrice: d.amount }];

  let subtotal = 0;
  for (const it of items) {
    if (y > H - 200) {
      doc.addPage();
      y = M;
    }
    const qty = Number(it.qty ?? 1);
    const unit = Number(it.unitPrice ?? 0);
    const lineTotal = qty * unit;
    subtotal += lineTotal;
    const descLines = doc.splitTextToSize(it.description || "—", W - M * 2 - 240);
    doc.text(descLines, M + 10, y);
    doc.text(String(qty), W - M - 200, y, { align: "right" });
    doc.text(`£${unit.toFixed(2)}`, W - M - 110, y, { align: "right" });
    doc.text(`£${lineTotal.toFixed(2)}`, W - M - 10, y, { align: "right" });
    const rowH = Math.max(descLines.length * 12, 14);
    y += rowH + 6;
    doc.setDrawColor(238).line(M, y - 2, W - M, y - 2);
  }

  // Totals
  y += 12;
  const labelX = W - M - 110;
  const valueX = W - M - 10;
  doc.setFontSize(10).setTextColor(110);
  doc.text("Subtotal", labelX, y, { align: "right" });
  doc.setTextColor(30);
  doc.text(`£${subtotal.toFixed(2)}`, valueX, y, { align: "right" });
  y += 18;

  const feeAmount = Math.max(0, Number(d.feeCents ?? 0)) / 100;
  if (feeAmount > 0) {
    doc.setTextColor(110);
    doc.text(d.feeLabel || "Card & processing fee", labelX, y, { align: "right" });
    doc.setTextColor(30);
    doc.text(`£${feeAmount.toFixed(2)}`, valueX, y, { align: "right" });
    y += 18;
  }
  const grandTotal = subtotal + feeAmount;

  // Total
  doc.setFillColor(br, bg, bb);
  doc.rect(W - M - 220, y - 14, 220, 28, "F");
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(255, 255, 255);
  doc.text("TOTAL DUE", W - M - 210, y + 4);
  doc.setFontSize(14);
  doc.text(`£${grandTotal.toFixed(2)}`, W - M - 10, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal").setTextColor(30);
  y += 36;

  // Payment link — big tappable "Press here to pay now" button
  if (d.paymentLink) {
    if (y > H - 180) { doc.addPage(); y = M; }
    const btnW = 260;
    const btnH = 44;
    const btnX = M;
    const btnY = y;
    doc.setFillColor(br, bg, bb);
    doc.roundedRect(btnX, btnY, btnW, btnH, 8, 8, "F");
    doc.link(btnX, btnY, btnW, btnH, { url: d.paymentLink });
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(255, 255, 255);
    doc.text("PRESS HERE TO PAY NOW", btnX + btnW / 2, btnY + btnH / 2 + 4, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(120);
    doc.text(
      feeAmount > 0
        ? `Secure payment powered by Stripe — includes £${feeAmount.toFixed(2)} ${(d.feeLabel || "card & processing fee").toLowerCase()}`
        : "Secure payment powered by Stripe",
      btnX,
      btnY + btnH + 14,
    );
    doc.setTextColor(60);
    y = btnY + btnH + 30;
  }

  // Bank details
  if (d.showBank && d.bank) {
    if (y > H - 160) { doc.addPage(); y = M; }
    doc.setDrawColor(220);
    const bx = M, by = y, bw = W - M * 2;
    const lines: { l: string; v: string }[] = [];
    if (d.bank.bankName) lines.push({ l: "Bank", v: d.bank.bankName });
    if (d.bank.accountName) lines.push({ l: "Account name", v: d.bank.accountName });
    if (d.bank.sortCode) lines.push({ l: "Sort code", v: d.bank.sortCode });
    if (d.bank.accountNumber) lines.push({ l: "Account number", v: d.bank.accountNumber });
    if (d.bank.iban) lines.push({ l: "IBAN", v: d.bank.iban });
    if (d.bank.swift) lines.push({ l: "SWIFT / BIC", v: d.bank.swift });
    const ref = d.bank.paymentReference || d.reference;
    if (ref) lines.push({ l: "Payment reference", v: ref });

    if (lines.length > 0) {
      const bh = 28 + lines.length * 14 + 12;
      doc.setFillColor(250, 248, 244);
      doc.rect(bx, by, bw, bh, "F");
      doc.rect(bx, by, bw, bh, "S");
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(br, bg, bb);
      doc.text("BANK TRANSFER DETAILS", bx + 12, by + 18);
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(40);
      lines.forEach((row, i) => {
        doc.setTextColor(120);
        doc.text(row.l, bx + 12, by + 36 + i * 14);
        doc.setTextColor(30);
        doc.text(row.v, bx + 140, by + 36 + i * 14);
      });
      y = by + bh + 16;
    }
  }

  // Footer notes
  if (d.footerNotes) {
    if (y > H - 80) { doc.addPage(); y = M; }
    doc.setFontSize(9).setTextColor(110);
    const fl = doc.splitTextToSize(d.footerNotes, W - M * 2);
    doc.text(fl, M, y);
    y += fl.length * 12 + 8;
  }

  doc.setFontSize(8).setTextColor(160);
  doc.text("Thank you for your custom.", M, H - 24);
  return doc;
}
