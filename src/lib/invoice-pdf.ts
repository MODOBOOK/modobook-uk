import { jsPDF } from "jspdf";

export type InvoiceData = {
  clinic: string;
  practitioner?: string;
  patientName?: string;
  patientEmail?: string;
  date: string;
  amount: number;
  notes?: string;
  paymentLink?: string;
  reference?: string;
};

export function generateInvoicePdf(d: InvoiceData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = M;

  // Header
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(20, 20, 20);
  doc.text(d.clinic || "Invoice", M, y);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(120);
  doc.text("INVOICE", W - M, y, { align: "right" });
  y += 8;
  if (d.practitioner) {
    doc.setFontSize(10).setTextColor(110);
    doc.text(d.practitioner, M, y + 12);
  }
  if (d.reference) {
    doc.setFontSize(9).setTextColor(150);
    doc.text(`Ref: ${d.reference}`, W - M, y + 12, { align: "right" });
  }
  y += 28;

  doc.setDrawColor(220).line(M, y, W - M, y);
  y += 22;

  // Billed to
  doc.setFontSize(9).setTextColor(140);
  doc.text("BILLED TO", M, y);
  doc.text("DATE", W - M, y, { align: "right" });
  y += 14;
  doc.setFontSize(11).setTextColor(30);
  doc.text(d.patientName || "—", M, y);
  doc.text(d.date, W - M, y, { align: "right" });
  if (d.patientEmail) {
    y += 14;
    doc.setFontSize(10).setTextColor(110);
    doc.text(d.patientEmail, M, y);
  }
  y += 28;

  // Line items / notes
  doc.setDrawColor(230).line(M, y, W - M, y);
  y += 16;
  doc.setFontSize(9).setTextColor(140);
  doc.text("DESCRIPTION", M, y);
  doc.text("AMOUNT", W - M, y, { align: "right" });
  y += 14;
  doc.setFontSize(11).setTextColor(30);
  const noteLines = doc.splitTextToSize(d.notes || "Treatment", W - M * 2 - 80);
  doc.text(noteLines, M, y);
  doc.setFont("helvetica", "bold");
  doc.text(`£${d.amount.toFixed(2)}`, W - M, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += noteLines.length * 14 + 14;

  doc.setDrawColor(230).line(M, y, W - M, y);
  y += 18;

  // Total
  doc.setFontSize(10).setTextColor(120);
  doc.text("TOTAL DUE", W - M - 110, y);
  doc.setFontSize(16).setFont("helvetica", "bold").setTextColor(20);
  doc.text(`£${d.amount.toFixed(2)}`, W - M, y, { align: "right" });
  y += 36;

  // Payment link
  if (d.paymentLink) {
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60);
    doc.text("Pay online securely:", M, y);
    y += 14;
    doc.setTextColor(37, 99, 235);
    doc.textWithLink(d.paymentLink, M, y, { url: d.paymentLink });
    doc.setTextColor(60);
    y += 24;
  }

  doc.setFontSize(9).setTextColor(160);
  doc.text("Thank you for your custom.", M, doc.internal.pageSize.getHeight() - M);
  return doc;
}
