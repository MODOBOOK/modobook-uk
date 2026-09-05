import { jsPDF } from "jspdf";

export type IncomeReportPdfData = {
  clinicName: string;
  brandColor?: string | null;
  periodLabel: string;
  totals: { gross: number; discounts: number; refunds: number; net: number; bookings: number; outstanding: number };
  byMethod: { label: string; amount: number; count: number }[];
  byTreatment: { label: string; amount: number; count: number }[];
  byMonth: { label: string; amount: number; count: number }[];
  rows: {
    date: string;
    patient: string;
    treatment: string;
    method: string;
    gross: number;
    discount: number;
    refunded: number;
    net: number;
  }[];
};

function hexToRgb(hex?: string | null): [number, number, number] {
  if (!hex) return [47, 67, 73];
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
  if (Number.isNaN(n)) return [47, 67, 73];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const money = (n: number) => `£${(Number.isFinite(n) ? n : 0).toFixed(2)}`;

export function generateIncomeReportPdf(d: IncomeReportPdfData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 42;
  const [br, bg, bb] = hexToRgb(d.brandColor);
  let y = 0;

  const newPage = () => {
    doc.addPage();
    doc.setFillColor(br, bg, bb);
    doc.rect(0, 0, W, 6, "F");
    y = M;
  };
  const ensure = (need: number) => {
    if (y + need > H - M) newPage();
  };

  doc.setFillColor(br, bg, bb);
  doc.rect(0, 0, W, 6, "F");
  y = M + 8;

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Income report", M, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  doc.text(d.clinicName || "Clinic", M, y);
  y += 14;
  doc.text(d.periodLabel, M, y);
  y += 12;
  doc.setFontSize(8);
  doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, M, y);
  y += 22;

  // Summary boxes
  const cards: [string, string][] = [
    ["Net income", money(d.totals.net)],
    ["Collected", money(d.totals.gross)],
    ["Refunds", money(d.totals.refunds)],
    ["Discounts", money(d.totals.discounts)],
    ["Outstanding", money(d.totals.outstanding)],
    ["Bookings", String(d.totals.bookings)],
  ];
  const cw = (W - M * 2 - 12 * 2) / 3;
  cards.forEach((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = M + col * (cw + 12);
    const cy = y + row * 60;
    doc.setDrawColor(220, 218, 212);
    doc.setFillColor(250, 249, 246);
    doc.roundedRect(x, cy, cw, 50, 6, 6, "FD");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(c[0].toUpperCase(), x + 10, cy + 18);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(c[1], x + 10, cy + 38);
    doc.setFont("helvetica", "normal");
  });
  y += 60 * Math.ceil(cards.length / 3) + 10;

  const section = (title: string, items: { label: string; amount: number; count: number }[]) => {
    if (!items.length) return;
    ensure(60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(title, M, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const it of items) {
      ensure(16);
      doc.setTextColor(60, 60, 60);
      doc.text(String(it.label).slice(0, 60), M, y);
      doc.text(String(it.count), W - M - 110, y, { align: "right" });
      doc.text(money(it.amount), W - M, y, { align: "right" });
      y += 14;
    }
    y += 10;
  };

  section("Income by payment method", d.byMethod);
  section("Income by treatment", d.byTreatment);
  if (d.byMonth.length > 1) section("Income by month", d.byMonth);

  // Transactions table
  ensure(60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text("Transactions", M, y);
  y += 16;

  const cols = [M, M + 68, M + 180, M + 300, M + 372, M + 440, W - M];
  const header = () => {
    doc.setFillColor(br, bg, bb);
    doc.rect(M, y - 11, W - M * 2, 16, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Date", cols[0]! + 4, y);
    doc.text("Patient", cols[1]! + 4, y);
    doc.text("Treatment", cols[2]! + 4, y);
    doc.text("Method", cols[3]! + 4, y);
    doc.text("Refund", cols[5]! - 6, y, { align: "right" });
    doc.text("Net", cols[6]! - 4, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 16;
  };
  header();

  doc.setFontSize(8);
  for (const r of d.rows) {
    if (y > H - M - 20) {
      newPage();
      header();
      doc.setFontSize(8);
    }
    doc.setTextColor(60, 60, 60);
    doc.text(r.date, cols[0]! + 4, y);
    doc.text(String(r.patient).slice(0, 20), cols[1]! + 4, y);
    doc.text(String(r.treatment).slice(0, 22), cols[2]! + 4, y);
    doc.text(String(r.method).replace(/_/g, " ").slice(0, 14), cols[3]! + 4, y);
    doc.text(r.refunded ? money(r.refunded) : "—", cols[5]! - 6, y, { align: "right" });
    doc.setTextColor(20, 20, 20);
    doc.text(money(r.net), cols[6]! - 4, y, { align: "right" });
    y += 13;
  }

  ensure(30);
  y += 6;
  doc.setDrawColor(220, 218, 212);
  doc.line(M, y, W - M, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("Total net income", M, y);
  doc.text(money(d.totals.net), W - M, y, { align: "right" });

  return doc;
}
