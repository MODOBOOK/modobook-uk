import jsPDF from "jspdf";

export type RxPdfInput = {
  clinic_name?: string | null;
  clinic_address?: string | null;
  prescriber_name: string;
  prescriber_reg_body?: string | null;
  prescriber_reg_number?: string | null;
  prescriber_address?: string | null;
  patient_name: string;
  patient_dob?: string | null;
  patient_address?: string | null;
  drug_name: string;
  drug_form?: string | null;
  drug_strength?: string | null;
  dose: string;
  quantity: string;
  directions: string;
  repeats_allowed?: number | null;
  valid_until?: string | null;
  notes?: string | null;
  signature_name?: string | null;
  signature_data_url?: string | null;
  signed_at?: string | null;
};

export function buildPrescriptionPdf(rx: RxPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = M;

  // Letterhead
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(rx.clinic_name || "Private Prescription", M, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (rx.clinic_address) {
    doc.text(rx.clinic_address, M, y);
    y += 14;
  }
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("UK Private Prescription (POM) — issued under prescriber authority", M, y);
  doc.setTextColor(0);
  y += 18;
  doc.setDrawColor(200);
  doc.line(M, y, W - M, y);
  y += 16;

  // Patient block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Patient", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const patient = [
    `Name: ${rx.patient_name}`,
    rx.patient_dob ? `Date of birth: ${rx.patient_dob}` : "",
    rx.patient_address ? `Address: ${rx.patient_address}` : "",
  ].filter(Boolean);
  patient.forEach((l) => {
    doc.text(l, M, y);
    y += 13;
  });
  y += 8;

  // Rx box
  doc.setDrawColor(50);
  doc.rect(M, y, W - M * 2, 160);
  let by = y + 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("℞", M + 14, by);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const drugLine = [rx.drug_name, rx.drug_strength, rx.drug_form].filter(Boolean).join(" · ");
  doc.text(drugLine, M + 44, by);
  by += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = [
    `Dose: ${rx.dose}`,
    `Quantity to supply: ${rx.quantity}`,
    `Repeats allowed: ${rx.repeats_allowed ?? 0}`,
    rx.valid_until ? `Valid until: ${rx.valid_until}` : "Valid for 6 months from date of signing",
  ];
  lines.forEach((l) => {
    doc.text(l, M + 44, by);
    by += 13;
  });
  by += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Directions for use:", M + 44, by);
  by += 13;
  doc.setFont("helvetica", "normal");
  const dirs = doc.splitTextToSize(rx.directions || "", W - M * 2 - 60);
  doc.text(dirs, M + 44, by);
  y += 180;

  if (rx.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Clinical notes:", M, y);
    y += 13;
    doc.setFont("helvetica", "normal");
    const notes = doc.splitTextToSize(rx.notes, W - M * 2);
    doc.text(notes, M, y);
    y += notes.length * 12 + 8;
  }

  // Prescriber + signature
  y = Math.max(y, doc.internal.pageSize.getHeight() - 160);
  doc.setDrawColor(200);
  doc.line(M, y, W - M, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Prescriber", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const pres = [
    `Name: ${rx.prescriber_name}`,
    rx.prescriber_reg_body || rx.prescriber_reg_number
      ? `Registration: ${[rx.prescriber_reg_body, rx.prescriber_reg_number].filter(Boolean).join(" · ")}`
      : "",
    rx.prescriber_address ? `Address: ${rx.prescriber_address}` : "",
  ].filter(Boolean);
  pres.forEach((l) => {
    doc.text(l, M, y);
    y += 13;
  });

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Signature:", M, y);
  if (rx.signature_data_url) {
    try {
      doc.addImage(rx.signature_data_url, "PNG", M + 70, y - 22, 160, 40);
    } catch {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(14);
      doc.text(rx.signature_name || "________________________", M + 70, y);
    }
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(14);
    doc.text(rx.signature_name || "________________________", M + 70, y);
  }
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (rx.signed_at) {
    doc.text(`Signed: ${new Date(rx.signed_at).toLocaleString("en-GB")}`, M, y + 26);
  }
  if (rx.signature_name) {
    doc.text(`Name: ${rx.signature_name}`, M + 240, y + 26);
  }

  return doc;
}

export function downloadPrescriptionPdf(rx: RxPdfInput, filename = "prescription.pdf") {
  buildPrescriptionPdf(rx).save(filename);
}
