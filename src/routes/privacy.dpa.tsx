import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/privacy/dpa")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Data Processing Addendum | MODO" },
      {
        name: "description",
        content:
          "MODO's Data Processing Addendum (DPA) for UK clinics under UK GDPR Article 28 — MODO acts as processor for patient data held by clinics acting as controllers.",
      },
    ],
  }),
  component: DpaPage,
});

function DpaPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/"><BrandMark size="sm" /></Link>
          <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">← Privacy</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-serif text-4xl tracking-tight">Data Processing Addendum</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Version 1.0 · Effective 12 July 2026 · UK GDPR Art. 28 · Contact:{" "}
          <a className="text-primary" href="mailto:info@modobook.co.uk">info@modobook.co.uk</a>
        </p>

        <div className="prose prose-neutral mt-8 max-w-none prose-h2:font-serif prose-h2:tracking-tight prose-a:text-primary">
          <p>
            This Data Processing Addendum ("DPA") forms part of the MODO Platform Terms &amp;
            Conditions accepted by the clinic ("<strong>Controller</strong>") and applies whenever
            MODO BOOKING PLATFORM (ICO reg. C1994747) ("<strong>MODO</strong>", "<strong>Processor</strong>") processes personal data
            on behalf of the Controller. It reflects the requirements of the UK GDPR and the Data
            Protection Act 2018.
          </p>

          <h2>1. Roles</h2>
          <ul>
            <li>The <strong>clinic / practitioner is the Controller</strong> of patient personal data (identity, contact, clinical, appointment and payment metadata) entered into MODO.</li>
            <li><strong>MODO is the Processor</strong>, processing that data solely on the Controller's documented instructions as set out in the Terms &amp; Conditions and this DPA.</li>
            <li>MODO is an independent Controller only for account-holder data (practitioner sign-in credentials, billing records, audit logs) and for platform security and abuse-prevention purposes.</li>
          </ul>

          <h2>2. Subject-matter, duration and nature of processing</h2>
          <p>
            MODO processes personal data on behalf of the Controller for the duration of the Terms
            in order to provide online booking, patient records, medical forms and consents,
            aftercare, marketing (where enabled by the Controller), reminders, reviews, prescribing
            hub features and payment orchestration.
          </p>

          <h2>3. Categories of data subjects and personal data</h2>
          <ul>
            <li><strong>Data subjects</strong>: the Controller's patients, prospective patients and, where applicable, the Controller's staff.</li>
            <li><strong>Categories of data</strong>: name, contact details, date of birth, address, appointment history, payment metadata, images and free-text clinical notes, consultation records, consent signatures, medical-form responses (including <strong>special-category health data</strong> under Art. 9), and photos uploaded by patients or clinicians.</li>
          </ul>

          <h2>4. MODO's obligations as Processor</h2>
          <ol>
            <li><strong>Documented instructions.</strong> Process personal data only on the Controller's documented instructions, including with regard to transfers, unless required by UK law.</li>
            <li><strong>Confidentiality.</strong> Ensure persons authorised to process the data are bound by confidentiality obligations.</li>
            <li><strong>Security (Art. 32).</strong> Implement appropriate technical and organisational measures — see Annex A.</li>
            <li><strong>Sub-processors.</strong> Engage sub-processors only under Art. 28 terms equivalent to this DPA. The current list is at Annex B. MODO will notify the Controller of any intended change and give the Controller a reasonable opportunity to object.</li>
            <li><strong>Data-subject rights.</strong> Provide the Controller with the tools (self-service export, deletion, correction) and reasonable co-operation to respond to Art. 12–22 requests within the statutory timeframe.</li>
            <li><strong>Breach notification.</strong> Notify the Controller without undue delay after becoming aware of a personal-data breach, per MODO's <Link to="/privacy/breach-response" className="text-primary">Breach Response Procedure</Link>.</li>
            <li><strong>DPIAs and consultation.</strong> Provide reasonable assistance to the Controller with data-protection impact assessments and prior consultation with the ICO where required (Art. 35–36).</li>
            <li><strong>Return or deletion.</strong> On termination and at the Controller's choice, return or delete Controller data within 30 days, subject to any legal-retention obligations MODO must comply with.</li>
            <li><strong>Audits.</strong> Make available all information necessary to demonstrate compliance with Art. 28 and allow for audits, including inspections, on reasonable notice (no more than once per 12 months except after a breach).</li>
          </ol>

          <h2>5. Controller's obligations</h2>
          <p>
            The Controller warrants that it has a lawful basis (Art. 6) and, for special-category
            data, a further Art. 9 condition (typically explicit consent or the provision of health
            or social care), and that it has provided data subjects with a privacy notice covering
            the processing carried out on MODO.
          </p>

          <h2>6. International transfers</h2>
          <p>
            MODO's platform and its primary sub-processors (see Annex B) are hosted in the UK/EEA
            or in jurisdictions the UK considers to provide adequate protection. Where a
            sub-processor transfers data outside the UK, MODO relies on the UK IDTA or the EU SCCs
            plus the UK Addendum, together with appropriate supplementary measures.
          </p>

          <h2>7. Liability and precedence</h2>
          <p>
            The liability provisions of the Terms &amp; Conditions apply to this DPA. In the event
            of conflict between this DPA and the Terms, this DPA prevails to the extent of the
            conflict and only in relation to processing carried out on behalf of the Controller.
          </p>

          <h2>Annex A — Technical and organisational measures</h2>
          <ul>
            <li>Encryption of data in transit (TLS 1.2+) and at rest (AES-256) on managed database and object storage.</li>
            <li>Row-level security policies scoping every read/write to the owning clinic.</li>
            <li>Role-based access; multi-factor authentication available for practitioner accounts and required for administrators.</li>
            <li>Comprehensive audit logging: PHI access log (<code>phi_access_log</code>), authentication events, payment events and email dispatch.</li>
            <li>Least-privilege service credentials; regular key rotation.</li>
            <li>Point-in-time database backups with a documented recovery target.</li>
            <li>Vulnerability scanning of application dependencies; secure SDLC.</li>
            <li>Documented breach-response procedure (see <Link to="/privacy/breach-response" className="text-primary">Breach Response</Link>).</li>
          </ul>

          <h2>Annex B — Sub-processors</h2>
          <p>
            Current list of sub-processors and the services they support. This list is updated when
            it changes; continued use of MODO after an update constitutes acceptance of the change
            unless the Controller objects in writing within 30 days.
          </p>
          <table>
            <thead>
              <tr><th>Sub-processor</th><th>Purpose</th><th>Region</th></tr>
            </thead>
            <tbody>
              <tr><td>Supabase (managed cloud)</td><td>Database, authentication, file storage, edge functions</td><td>EU (Ireland)</td></tr>
              <tr><td>Stripe Payments UK, Ltd.</td><td>Payment processing (Connect)</td><td>UK / EEA</td></tr>
              <tr><td>Mailgun (Sinch)</td><td>Transactional email delivery</td><td>EU</td></tr>
              <tr><td>Apple Push Notification service</td><td>iOS push notifications</td><td>US (Standard Contractual Clauses)</td></tr>
              <tr><td>MODO AI Gateway (OpenAI-compatible)</td><td>Optional AI features: form / aftercare / consent generation</td><td>EU / US (SCCs)</td></tr>
              <tr><td>Google Maps Platform</td><td>Address autocomplete on booking pages (optional)</td><td>US (SCCs)</td></tr>
            </tbody>
          </table>

          <p className="mt-8 text-sm text-muted-foreground">
            See also: <Link to="/terms" className="text-primary">Terms &amp; Conditions</Link> ·{" "}
            <Link to="/privacy" className="text-primary">Privacy Policy</Link> ·{" "}
            <Link to="/privacy/dpia" className="text-primary">DPIA</Link> ·{" "}
            <Link to="/privacy/breach-response" className="text-primary">Breach Response</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
