import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/privacy/dpia")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Data Protection Impact Assessment | MODO" },
      {
        name: "description",
        content:
          "MODO's Data Protection Impact Assessment (DPIA) for processing special-category health data under UK GDPR Article 35.",
      },
    ],
  }),
  component: DpiaPage,
});

function DpiaPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/"><BrandMark size="sm" /></Link>
          <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">← Privacy</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-serif text-4xl tracking-tight">Data Protection Impact Assessment</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Version 1.0 · Effective 2 July 2026 · Owner: MODO BOOKING PLATFORM (ICO reg. C1994747) (Data Controller for platform data; Data Processor
          for clinic-hosted patient data) · Contact: <a className="text-primary" href="mailto:info@modobook.co.uk">info@modobook.co.uk</a>
        </p>

        <div className="prose prose-neutral mt-8 max-w-none prose-h2:font-serif prose-h2:tracking-tight prose-a:text-primary">
          <h2>1. Purpose of this DPIA</h2>
          <p>
            This Data Protection Impact Assessment is carried out under Article 35 of the UK GDPR because MODO
            processes special-category health data (medical history, allergies, consultation notes, prescriptions,
            before/after photographs) on a systematic basis and at scale on behalf of independent aesthetic
            practitioners across the United Kingdom.
          </p>

          <h2>2. Description of processing</h2>
          <ul>
            <li><strong>Nature:</strong> web-based booking, medical intake, consultation record and prescription platform.</li>
            <li><strong>Scope:</strong> patients booking with UK-based aesthetic practitioners; clinic staff; independent prescribers linked via the Prescriber Hub.</li>
            <li><strong>Context:</strong> patients hand over data to the specific clinic they book with; MODO hosts that data on the clinic's behalf.</li>
            <li><strong>Purposes:</strong> appointment booking, clinical record-keeping, consent capture, prescription generation, payment collection, statutory record retention.</li>
            <li><strong>Categories of data:</strong> identity, contact, DOB, address, GP details, emergency contact, medical history, allergies, medications, treatment photographs, prescription records, payment metadata.</li>
            <li><strong>Data subjects:</strong> patients, practitioners, prescribers, clinic staff.</li>
          </ul>

          <h2>3. Necessity and proportionality</h2>
          <ul>
            <li><strong>Lawful basis (Art. 6):</strong> Contract (booking &amp; payment); Legal obligation (medical record retention); Legitimate interests (fraud prevention, platform security).</li>
            <li><strong>Special-category condition (Art. 9):</strong> §9(2)(h) — provision of health or social care by a health professional bound by a duty of confidentiality; supplemented by explicit consent (§9(2)(a)) captured at booking.</li>
            <li><strong>Data minimisation:</strong> intake forms are practitioner-authored and configurable; patients can decline optional fields; photographs are only requested when clinically indicated.</li>
            <li><strong>Retention:</strong> 8 years adult medical, 25 years paediatric, 10 years prescriptions, 7 years financial. Patient-erasure requests pseudonymise identifiers while preserving anonymised clinical records for statutory periods.</li>
          </ul>

          <h2>4. Consultation</h2>
          <p>
            The DPIA has been reviewed internally by the Data Protection Officer. Practitioners are consulted at
            onboarding on their record-keeping obligations. Patients receive the Privacy Notice at first booking
            and can request further information from <a href="mailto:info@modobook.co.uk">info@modobook.co.uk</a>.
          </p>

          <h2>5. Risks identified and mitigations</h2>
          <table>
            <thead>
              <tr><th>Risk</th><th>Likelihood</th><th>Impact</th><th>Mitigation</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Unauthorised cross-clinic access to patient records</td>
                <td>Low</td><td>High</td>
                <td>Row-Level Security enforces <code>auth.uid()</code> and per-clinic ownership on every clinical table; helper functions <code>is_profile_owner()</code> and <code>is_patient_of_profile()</code>.</td>
              </tr>
              <tr>
                <td>Interception of clinical photographs</td>
                <td>Low</td><td>High</td>
                <td>Private Supabase Storage bucket; short-lived signed URLs (10 min TTL); per-file RLS bound to patient's linked consultation.</td>
              </tr>
              <tr>
                <td>Data leaving the EEA</td>
                <td>Low</td><td>Medium</td>
                <td>All data at rest in AWS eu-west-3 (Paris). Transactional email routed through our managed EU relay. No US sub-processors receive clinical content.</td>
              </tr>
              <tr>
                <td>Session/credential compromise</td>
                <td>Medium</td><td>High</td>
                <td>Supabase Auth with HIBP-checked passwords, Google OAuth, bearer-token revalidation on every privileged server call.</td>
              </tr>
              <tr>
                <td>Malicious insider (rogue practitioner)</td>
                <td>Low</td><td>High</td>
                <td>PHI access log records every practitioner-side read/write against clinical tables (triggered at database level and only readable by the clinic owner). Erasure and audit trails support disciplinary/regulatory action.</td>
              </tr>
              <tr>
                <td>Loss of availability</td>
                <td>Low</td><td>Medium</td>
                <td>Managed Postgres with automated daily backups; point-in-time recovery available on our managed cloud.</td>
              </tr>
              <tr>
                <td>Failure to honour subject rights</td>
                <td>Low</td><td>Medium</td>
                <td>Patient self-service "Download my data" and "Request erasure" endpoints under <code>/m/&#123;slug&#125;/account</code>.</td>
              </tr>
            </tbody>
          </table>

          <h2>6. Residual risk</h2>
          <p>
            After applying the mitigations above, residual risk is assessed as <strong>LOW</strong>. Processing may
            proceed without prior consultation with the ICO.
          </p>

          <h2>7. Sign-off</h2>
          <p>
            Approved by the MODO DPO on the effective date above. This DPIA is reviewed at least annually, and on
            any material change to processing (new data category, new sub-processor, change of hosting region, or
            introduction of automated decision-making).
          </p>

          <p className="mt-8 text-sm text-muted-foreground">
            See also: <Link to="/privacy" className="text-primary">Privacy Policy</Link> ·{" "}
            <Link to="/privacy/breach-response" className="text-primary">Breach Response Procedure</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
