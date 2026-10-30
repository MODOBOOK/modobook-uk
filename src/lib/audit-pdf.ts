import { jsPDF } from "jspdf";

type Q = { id: string; text: string; section?: string | null };
type A = { result?: string; comment?: string };

export type AuditPdfData = {
  clinicName: string;
  brandColor?: string | null;
  audit: {
    name: string;
    conducted_on: string;
    conducted_by_name?: string | null;
    signed_off_by_name?: string | null;
    signed_off_at?: string | null;
    status: string;
    score_percent: number | null;
    summary?: string | null;
    questions: Q[] | unknown;
    answers: Record<string, A> | unknown;
  };
  actions?: { description: string; owner_name?: string | null; due_on?: string | null; status?: string | null }[];
};

function hexToRgb(hex?: string | null): [number, number, number] {
  const fb: [number, number, number] = [14, 13, 11];
  if (!hex) return fb;
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
  if (Number.isNaN(n)) return fb;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const ukDate = (d?: string | null) =>
  d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";

function renderAudit(doc: jsPDF, d: AuditPdfData, startPage: number) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 44;
  const [br, bg, bb] = hexToRgb(d.brandColor);
  const a = d.audit;
  const questions = (Array.isArray(a.questions) ? a.questions : []) as Q[];
  const answers = (a.answers && typeof a.answers === "object" ? a.answers : {}) as Record<string, A>;
  let y = 0;

  const band = () => {
    doc.setFillColor(br, bg, bb);
    doc.rect(0, 0, W, 8, "F");
  };
  const newPage = () => {
    doc.addPage();
    band();
    y = M;
  };
  const ensure = (need: number) => {
    if (y + need > H - M - 20) newPage();
  };

  // Header block
  doc.setFillColor(br, bg, bb);
  doc.rect(0, 0, W, 96, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text((d.clinicName || "Clinic").toUpperCase(), M, 34, { charSpace: 1.5 });
  doc.setFont("times", "italic");
  doc.setFontSize(24);
  doc.text(doc.splitTextToSize(a.name, W - M * 2 - 110)[0] as string, M, 66);
  // score
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text(a.score_percent == null ? "—" : `${a.score_percent}%`, W - M, 62, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("SCORE", W - M, 76, { align: "right" });
  y = 124;

  // Meta
  const status =
    a.status === "signed_off" ? "Signed off" : a.status === "completed" ? "Awaiting sign-off" : "Draft";
  const yes = questions.filter((q) => answers[q.id]?.result === "yes").length;
  const no = questions.filter((q) => answers[q.id]?.result === "no").length;
  const na = questions.filter((q) => answers[q.id]?.result === "na").length;
  const meta: [string, string][] = [
    ["Date conducted", ukDate(a.conducted_on)],
    ["Conducted by", a.conducted_by_name || "—"],
    ["Status", status],
    ["Signed off", a.signed_off_by_name ? `${a.signed_off_by_name}, ${ukDate(a.signed_off_at)}` : "—"],
    ["Results", `${yes} met · ${no} not met · ${na} N/A`],
  ];
  doc.setFontSize(9);
  for (const [k, v] of meta) {
    doc.setTextColor(120, 120, 120);
    doc.text(k, M, y);
    doc.setTextColor(20, 20, 20);
    doc.text(v, M + 110, y);
    y += 15;
  }
  y += 12;

  // Standards
  let section: string | null | undefined = undefined;
  for (const q of questions) {
    const ans = answers[q.id] ?? {};
    if (q.section !== section) {
      section = q.section;
      if (section) {
        ensure(40);
        y += 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(br, bg, bb);
        doc.text(String(section).toUpperCase(), M, y, { charSpace: 1 });
        y += 6;
        doc.setDrawColor(br, bg, bb);
        doc.line(M, y, W - M, y);
        y += 14;
      }
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(q.text || "", W - M * 2 - 80) as string[];
    const comment = ans.comment?.trim()
      ? (doc.splitTextToSize(`Note: ${ans.comment.trim()}`, W - M * 2 - 80) as string[])
      : [];
    ensure(lines.length * 13 + comment.length * 12 + 10);
    doc.setTextColor(30, 30, 30);
    doc.text(lines, M, y);
    const label = ans.result === "yes" ? "Met" : ans.result === "no" ? "Not met" : ans.result === "na" ? "N/A" : "—";
    const col: [number, number, number] =
      ans.result === "yes" ? [22, 128, 72] : ans.result === "no" ? [185, 40, 40] : [130, 130, 130];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...col);
    doc.text(label, W - M, y, { align: "right" });
    y += lines.length * 13;
    if (comment.length) {
      doc.setFont("helvetica", "italic");
      doc.setTextColor(110, 110, 110);
      doc.text(comment, M + 8, y);
      y += comment.length * 12;
    }
    y += 8;
  }

  const block = (title: string, body: string[]) => {
    ensure(50);
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(title, M, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    for (const b of body) {
      const ls = doc.splitTextToSize(b, W - M * 2) as string[];
      ensure(ls.length * 13 + 4);
      doc.text(ls, M, y);
      y += ls.length * 13 + 4;
    }
  };
  if (a.summary?.trim()) block("Summary", [a.summary.trim()]);
  if (d.actions?.length)
    block(
      "Actions",
      d.actions.map(
        (x) =>
          `• ${x.description}${x.owner_name ? ` — ${x.owner_name}` : ""}${x.due_on ? ` (due ${ukDate(x.due_on)})` : ""}${x.status === "done" ? " ✓ done" : ""}`.replace("✓ ", ""),
      ),
    );

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(`${d.clinicName || "Clinic"} · ${a.name} · Generated ${new Date().toLocaleDateString("en-GB")}`, M, H - 24);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 24, { align: "right" });
  }
  return doc;
}
