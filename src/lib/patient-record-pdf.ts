import { jsPDF } from "jspdf";

export type PatientRecordInput = {
  clinic?: {
    clinic_name?: string | null;
    full_name?: string | null;
    logo_url?: string | null;
    brand_color?: string | null;
    address?: any;
    email?: string | null;
    phone?: string | null;
  } | null;
  patient: any;
  notes: Array<{ id: string; body: string; created_at: string; visible_to_patient?: boolean | null }>;
  consultations: Array<any>;
  appointments?: Array<any>;
  options: {
    includeDetails: boolean;
    includeNotes: boolean;
    includeConsultations: boolean;
    includeAppointments: boolean;
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

function fmtDate(d?: string | null) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return String(d); }
}
function fmtDateTime(d?: string | null) {
  if (!d) return "";
  try { return new Date(d).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" }); }
  catch { return String(d); }
}
function ageFromDob(dob?: string | null) {
  if (!dob) return null;
  const d = new Date(dob); if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

export async function generatePatientRecordPdf(input: PatientRecordInput): Promise<jsPDF> {
  const { clinic, patient, notes, consultations, appointments = [], options } = input;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const CONTENT_W = W - M * 2;
  const [br, bg, bb] = hexToRgb(clinic?.brand_color);

  const logoData = await loadImageDataUrl(clinic?.logo_url);

  let y = M;
  let pageIndex = 0;

  function drawPageChrome() {
    // Top brand band
    doc.setFillColor(br, bg, bb);
    doc.rect(0, 0, W, 4, "F");
    // Footer will be drawn at end
  }

  function newPage() {
    doc.addPage();
    pageIndex++;
    y = M;
    drawPageChrome();
  }

  function ensure(space: number) {
    if (y + space > H - M - 30) newPage();
  }

  function sectionTitle(label: string) {
    ensure(46);
    y += 6;
    doc.setDrawColor(br, bg, bb).setLineWidth(2);
    doc.line(M, y, M + 26, y);
    doc.setLineWidth(0.5);
    y += 14;
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(20, 20, 20);
    doc.text(label, M, y);
    y += 12;
    doc.setDrawColor(235).line(M, y, W - M, y);
    y += 14;
  }

  function labelValue(label: string, value?: string | null) {
    if (!value) return;
    ensure(28);
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(120);
    doc.text(label.toUpperCase(), M, y);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(30);
    const lines = doc.splitTextToSize(String(value), CONTENT_W - 120);
    doc.text(lines, M + 130, y);
    y += Math.max(14, lines.length * 12) + 4;
  }

  function paragraph(text: string, size = 10, color: [number, number, number] = [40, 40, 40]) {
    if (!text) return;
    doc.setFont("helvetica", "normal").setFontSize(size).setTextColor(...color);
    const lines = doc.splitTextToSize(text, CONTENT_W);
    for (const line of lines) {
      ensure(size + 4);
      doc.text(line, M, y);
      y += size + 4;
    }
  }

  // === Header (page 1) ===
  drawPageChrome();
  y = M + 8;

  if (logoData) {
    try { doc.addImage(logoData, "PNG", M, y, 56, 56, undefined, "FAST"); } catch {}
  }
  const headerLeft = logoData ? M + 70 : M;
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(20, 20, 20);
  doc.text(clinic?.clinic_name || "Patient record", headerLeft, y + 22);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(110);
  const subline = [clinic?.full_name, clinic?.email, clinic?.phone].filter(Boolean).join("  ·  ");
  if (subline) doc.text(subline, headerLeft, y + 40);
  if (clinic?.address) {
    const addr = typeof clinic.address === "string"
      ? clinic.address
      : Object.values(clinic.address).filter(Boolean).join(", ");
    if (addr) doc.text(addr, headerLeft, y + 54);
  }

  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(br, bg, bb);
  doc.text("PATIENT RECORD", W - M, y + 22, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(120);
  doc.text(`Generated ${fmtDateTime(new Date().toISOString())}`, W - M, y + 38, { align: "right" });

  y += 80;
  doc.setDrawColor(220).line(M, y, W - M, y);
  y += 18;

  // === Patient identity block ===
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(20, 20, 20);
  doc.text(patient?.full_name || "Unnamed patient", M, y);
  y += 22;
  const idBits: string[] = [];
  if (patient?.dob) {
    const a = ageFromDob(patient.dob);
    idBits.push(`DOB ${fmtDate(patient.dob)}${a != null ? ` (age ${a})` : ""}`);
  }
  if (patient?.gender) idBits.push(patient.gender);
  if (patient?.email) idBits.push(patient.email);
  if (patient?.phone) idBits.push(patient.phone);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90);
  const idLines = doc.splitTextToSize(idBits.join("  ·  "), CONTENT_W);
  doc.text(idLines, M, y);
  y += idLines.length * 13 + 6;

  if (patient?.has_allergies && patient?.allergies) {
    ensure(40);
    doc.setFillColor(254, 242, 242).setDrawColor(252, 165, 165);
    const lines = doc.splitTextToSize(String(patient.allergies), CONTENT_W - 24);
    const h = 22 + lines.length * 12;
    doc.roundedRect(M, y, CONTENT_W, h, 6, 6, "FD");
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(185, 28, 28);
    doc.text("⚠  ALLERGIES", M + 12, y + 15);
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(120, 20, 20);
    doc.text(lines, M + 12, y + 30);
    y += h + 12;
  }

  // === Personal details ===
  if (options.includeDetails) {
    sectionTitle("Personal details");
    labelValue("Address", [patient?.address_line1 || patient?.address, patient?.address_line2, patient?.county, patient?.postcode].filter(Boolean).join(", "));
    labelValue("Preferred contact", patient?.preferred_contact);
    labelValue("How they heard", patient?.how_heard);
    labelValue("Marketing opt-in", patient?.marketing_opt_in ? "Yes" : "No");

    sectionTitle("Emergency & GP");
    labelValue("GP name", patient?.gp_name);
    labelValue("GP address", patient?.gp_address);
    labelValue("Next of kin", patient?.emergency_contact_name);
    labelValue("Contact phone", patient?.emergency_contact_phone);
  }

  // === Appointments ===
  if (options.includeAppointments && appointments.length > 0) {
    sectionTitle(`Appointments (${appointments.length})`);
    for (const a of appointments.slice(0, 40)) {
      ensure(34);
      doc.setDrawColor(235).setFillColor(250, 249, 246);
      doc.roundedRect(M, y, CONTENT_W, 28, 4, 4, "FD");
      doc.setFillColor(br, bg, bb).rect(M, y, 3, 28, "F");
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(30);
      doc.text(String(a.treatment_name || a.title || "Appointment"), M + 12, y + 12);
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
      const when = fmtDateTime(a.starts_at || a.start_time);
      const right = [when, a.status].filter(Boolean).join("  ·  ");
      doc.text(right, W - M - 8, y + 12, { align: "right" });
      if (a.location_name) doc.text(String(a.location_name), M + 12, y + 22);
      y += 32;
    }
  }

  // === Consultations ===
  if (options.includeConsultations && consultations.length > 0) {
    sectionTitle(`Consultations (${consultations.length})`);
    for (const c of consultations) {
      ensure(70);
      doc.setDrawColor(220);
      doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(20);
      doc.text(fmtDate(c.created_at) || "Consultation", M, y);
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(br, bg, bb);
      doc.text((c.status || "").toUpperCase(), W - M, y, { align: "right" });
      y += 6;
      doc.line(M, y + 4, W - M, y + 4);
      y += 16;

      const medNotes = c.medical?.notes;
      const medAnswers = c.medical?.answers && Object.entries(c.medical.answers).filter(([, v]) => v).map(([k]) => k);
      if (medAnswers?.length) {
        doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(90);
        ensure(16); doc.text("Medical flags", M, y); y += 12;
        paragraph(medAnswers.join(", "), 9, [60, 60, 60]);
      }
      if (medNotes) {
        doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(90);
        ensure(16); doc.text("Medical notes", M, y); y += 12;
        paragraph(String(medNotes), 9);
      }

      const concerns = c.concerns?.selected;
      const concernNotes = c.concerns?.notes;
      if (concerns?.length || concernNotes) {
        doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(90);
        ensure(16); doc.text("Concerns", M, y); y += 12;
        if (concerns?.length) paragraph(concerns.join(", "), 9, [60, 60, 60]);
        if (concernNotes) paragraph(String(concernNotes), 9);
      }

      const assess = c.assessment?.notes;
      if (assess) {
        doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(90);
        ensure(16); doc.text("Clinical assessment", M, y); y += 12;
        paragraph(String(assess), 9);
      }

      const plan = c.treatment_plan;
      if (plan) {
        const planText = typeof plan === "string" ? plan : plan.notes || plan.summary || (Array.isArray(plan.items) ? plan.items.map((i: any) => `• ${i.name || i.title || ""}`).join("\n") : "");
        if (planText) {
          doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(90);
          ensure(16); doc.text("Treatment plan", M, y); y += 12;
          paragraph(String(planText), 9);
        }
      }

      const log = c.treatment_log;
      if (Array.isArray(log?.items) && log.items.length) {
        doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(90);
        ensure(16); doc.text("Treatment log", M, y); y += 12;
        for (const it of log.items) {
          const line = [it.product, it.batch && `batch ${it.batch}`, it.expiry && `exp ${it.expiry}`, it.dose && `${it.dose}`].filter(Boolean).join(" · ");
          paragraph(`• ${line}`, 9);
        }
      }

      y += 10;
    }
  }

  // === Notes ===
  if (options.includeNotes && notes.length > 0) {
    sectionTitle(`Practitioner notes (${notes.length})`);
    for (const n of notes) {
      const bodyLines = doc.splitTextToSize(n.body || "—", CONTENT_W - 24);
      const cardH = 34 + bodyLines.length * 12 + 10;
      ensure(cardH + 4);
      doc.setDrawColor(230).setFillColor(250, 249, 246);
      doc.roundedRect(M, y, CONTENT_W, cardH, 6, 6, "FD");
      doc.setFillColor(br, bg, bb).rect(M, y, 3, cardH, "F");

      doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(90);
      doc.text(fmtDateTime(n.created_at), M + 12, y + 16);
      const tag = n.visible_to_patient ? "SHARED WITH PATIENT" : "PRIVATE";
      doc.setFont("helvetica", "bold").setFontSize(8);
      if (n.visible_to_patient) doc.setTextColor(br, bg, bb); else doc.setTextColor(160);
      doc.text(tag, W - M - 10, y + 16, { align: "right" });

      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(30);
      doc.text(bodyLines, M + 12, y + 32);
      y += cardH + 10;
    }
  }

  // === Sign-off ===
  ensure(140);
  y = Math.max(y + 12, H - M - 120);
  doc.setDrawColor(220).line(M, y, W - M, y);
  y += 18;
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(30);
  doc.text("Practitioner sign-off", M, y);
  y += 20;
  const colW = (CONTENT_W - 30) / 2;
  doc.setDrawColor(120);
  doc.line(M, y + 40, M + colW, y + 40);
  doc.line(M + colW + 30, y + 40, W - M, y + 40);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
  doc.text("Signature", M, y + 54);
  doc.text("Date", M + colW + 30, y + 54);
  doc.setFontSize(10).setTextColor(40);
  if (clinic?.full_name) doc.text(clinic.full_name, M, y + 12);
  if (clinic?.clinic_name) { doc.setFontSize(9).setTextColor(110); doc.text(clinic.clinic_name, M, y + 26); }

  // === Footer ===
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor(150);
    doc.text(
      `${clinic?.clinic_name ?? ""}  ·  ${patient?.full_name ?? ""}  ·  Confidential  ·  Page ${i} of ${pages}`,
      W / 2, H - 18, { align: "center" },
    );
  }
  return doc;
}
