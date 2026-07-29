import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/privacy/retention")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Data Retention Schedule | MODO" },
      {
        name: "description",
        content:
          "How long MODO keeps each type of record — clinical notes, consents, photos, prescriptions, payments and marketing data — and the legal basis for each period.",
      },
      { property: "og:title", content: "Data Retention Schedule | MODO" },
      {
        property: "og:description",
        content: "Retention periods for clinical, financial and marketing records held in MODO.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RetentionPage,
});

const ROWS: Array<{ record: string; period: string; basis: string }> = [
  {
    record: "Medical history forms & health questionnaires",
    period: "8 years after last treatment (until age 25 for a patient treated as a child, or 26 if treated at 17)",
    basis: "Legal obligation / professional standards (NMC, GMC, GPhC; NHS Records Management Code)",
  },
  {
    record: "Consultation notes & treatment records",
    period: "8 years after last treatment",
    basis: "Legal obligation, defence of legal claims (Limitation Act / Prescription (Scotland) Act)",
  },
  {
    record: "Signed consent forms",
    period: "8 years after the treatment they relate to",
    basis: "Legal obligation, evidence of valid consent",
  },
  {
    record: "Prescriptions & prescribing audit trail",
    period: "10 years",
    basis: "Human Medicines Regulations 2012 / prescriber professional duties",
  },
  {
    record: "Before/after and clinical photographs",
    period: "8 years after last treatment, or deleted on withdrawal of consent where not needed for a clinical or legal record",
    basis: "Explicit consent (Art. 9(2)(a)); clinical record-keeping",
  },
  {
    record: "Appointment history (dates, treatments, status)",
    period: "8 years after last appointment",
    basis: "Contract, clinical record-keeping",
  },
  {
    record: "Aftercare responses & follow-up messages",
    period: "8 years after last treatment",
    basis: "Clinical record-keeping",
  },
  {
    record: "Payments, invoices, refunds & Stripe references",
    period: "7 years from end of the financial year",
    basis: "HMRC / Companies Act record-keeping",
  },
  {
    record: "Card-on-file mandates (no card numbers stored by MODO)",
    period: "Until the patient or clinic removes it, or 24 months of inactivity",
    basis: "Contract, legitimate interests (no-show protection)",
  },
  {
    record: "Practitioner account & subscription records",
    period: "7 years after account closure (billing), 24 months (login/access logs)",
    basis: "Legal obligation, security",
  },
  {
    record: "Marketing consents, campaigns & engagement data",
    period: "24 months from last engagement, then removed from active lists",
    basis: "Consent (PECR); legitimate interests",
  },
  {
    record: "Unsubscribe / suppression list",
    period: "Retained indefinitely",
    basis: "Legal obligation — required to honour opt-outs",
  },
  {
    record: "PHI access audit log",
    period: "24 months",
    basis: "Security, accountability (Art. 5(2), Art. 32)",
  },
  {
    record: "Support correspondence & DSAR records",
    period: "3 years from closure",
    basis: "Accountability, defence of legal claims",
  },
  {
    record: "Backups",
    period: "Rolling 30 days, then overwritten",
    basis: "Business continuity (Art. 32(1)(c))",
  },
];

function RetentionPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/"><BrandMark size="sm" /></Link>
          <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">← Privacy</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-serif text-4xl tracking-tight">Data Retention Schedule</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          MODO BOOKING PLATFORM · ICO registration <strong>C1994747</strong> · UK GDPR Art. 5(1)(e)
        </p>

        <div className="prose prose-neutral mt-8 max-w-none prose-h2:font-serif prose-h2:tracking-tight prose-a:text-primary">
          <h2>How to read this schedule</h2>
          <p>
            Personal data must be kept no longer than necessary. For patient clinical records the
            treating practitioner is the Data Controller and sets the final retention period in line
            with their regulator and indemnity provider; MODO applies the periods below as the
            platform default and will not delete a clinical record earlier than the practitioner's
            own policy allows.
          </p>

          <table>
            <thead>
              <tr>
                <th>Record type</th>
                <th>Retention period</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.record}>
                  <td><strong>{r.record}</strong></td>
                  <td>{r.period}</td>
                  <td>{r.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>What happens at the end of a period</h2>
          <ul>
            <li>Records are deleted or irreversibly anonymised, including from file storage.</li>
            <li>Deletions propagate to backups within 30 days as the rolling backup window turns over.</li>
            <li>Where only part of a record has expired, we delete the expired fields and keep the rest.</li>
          </ul>

          <h2>Early erasure</h2>
          <p>
            You can ask for erasure at any time. We will delete anything not required for a legal,
            clinical or financial obligation, and tell you clearly what must be retained and for how
            long. Requests go through our{" "}
            <Link to="/privacy/complaints">complaints &amp; subject-access procedure</Link>.
          </p>

          <h2>Clinic closure or leaving MODO</h2>
          <p>
            A practitioner leaving MODO can export their full patient records before closure. Unless
            they instruct otherwise in writing, we retain the clinic's clinical data for the periods
            above so patients can still exercise their rights, then delete it. Account and marketing
            data are deleted within 90 days of closure, subject to the financial retention above.
          </p>
        </div>

        <div className="mt-10 border-t pt-6 text-sm text-muted-foreground">
          See also: <Link to="/privacy" className="underline">Privacy Policy</Link>{" · "}
          <Link to="/privacy/cookies" className="underline">Cookie Policy</Link>{" · "}
          <Link to="/privacy/complaints" className="underline">Complaints &amp; SAR</Link>
        </div>
      </main>
    </div>
  );
}
