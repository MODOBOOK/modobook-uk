import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/privacy/breach-response")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Personal Data Breach Response Procedure | MODO" },
      {
        name: "description",
        content:
          "MODO's UK GDPR Article 33/34 breach response procedure: detection, containment, ICO notification within 72 hours, and communication with affected patients.",
      },
    ],
  }),
  component: BreachPage,
});

function BreachPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/"><BrandMark size="sm" /></Link>
          <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">← Privacy</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-serif text-4xl tracking-tight">Personal Data Breach Response Procedure</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Version 1.0 · Effective 2 July 2026 · Owner: MODO BOOKING PLATFORM (ICO reg. C1994747) data protection lead · Contact:{" "}
          <a className="text-primary" href="mailto:info@modobook.co.uk">info@modobook.co.uk</a>
        </p>

        <div className="prose prose-neutral mt-8 max-w-none prose-h2:font-serif prose-h2:tracking-tight prose-a:text-primary">
          <h2>1. Scope</h2>
          <p>
            This procedure applies to any personal data breach affecting data processed by MODO under UK GDPR
            Articles 33 and 34, including unauthorised access, accidental loss, alteration or disclosure of
            personal or special-category health data.
          </p>

          <h2>2. Reporting a suspected breach</h2>
          <p>
            Anyone — patient, practitioner, employee, contractor or member of the public — who suspects a breach
            must report it immediately to <a href="mailto:info@modobook.co.uk">info@modobook.co.uk</a> with the
            subject line <em>"DATA BREACH"</em>. Include: what happened, when, what data may be involved, and any
            evidence (screenshots, URLs, timestamps). Do not attempt to test or exploit further.
          </p>

          <h2>3. Timeline &amp; responsibilities</h2>
          <table>
            <thead>
              <tr><th>Hour</th><th>Action</th><th>Owner</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>T + 0h</td>
                <td>Log incident in the internal breach register; assign a unique reference; acknowledge reporter.</td>
                <td>DPO</td>
              </tr>
              <tr>
                <td>T + 1h</td>
                <td><strong>Contain</strong>: revoke compromised credentials, invalidate sessions, rotate API keys, restrict traffic if necessary.</td>
                <td>Engineering on-call</td>
              </tr>
              <tr>
                <td>T + 4h</td>
                <td><strong>Assess</strong> scope and severity: categories of data, number of subjects, likelihood of harm, whether special-category data is involved. Review PHI access log and audit trails.</td>
                <td>DPO + Engineering</td>
              </tr>
              <tr>
                <td>T + 24h</td>
                <td><strong>Decide</strong> notification requirements based on risk to rights and freedoms.</td>
                <td>DPO</td>
              </tr>
              <tr>
                <td>T + 72h</td>
                <td><strong>Notify the ICO</strong> where the breach is likely to result in a risk to rights and freedoms, using the ICO's online reporting form (<a href="https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/" target="_blank" rel="noreferrer">ico.org.uk</a>). If notification is delayed, record the reasons.</td>
                <td>DPO</td>
              </tr>
              <tr>
                <td>Without undue delay</td>
                <td><strong>Notify affected patients</strong> where the breach is likely to result in a <em>high</em> risk to their rights and freedoms (Art. 34). Communication uses plain English and describes the nature of the breach, contact point, likely consequences, and mitigating actions taken.</td>
                <td>DPO</td>
              </tr>
              <tr>
                <td>T + 7 days</td>
                <td><strong>Post-incident review</strong>: root cause analysis, remediation plan, update to controls, DPIA review, retro logged in breach register.</td>
                <td>DPO + Engineering</td>
              </tr>
            </tbody>
          </table>

          <h2>4. Communication with practitioners (as controllers)</h2>
          <p>
            Where a breach affects patient data held for a specific clinic, MODO (acting as processor) will notify
            the affected clinic's registered contact without undue delay so that the clinic can meet its own
            controller obligations under Art. 33.
          </p>

          <h2>5. Evidence &amp; audit trail</h2>
          <ul>
            <li>PHI access log (<code>phi_access_log</code>): every practitioner-side read/write of clinical records.</li>
            <li>Email send log: every transactional email dispatched.</li>
            <li>Auth event log: sign-in, password change, email change (via Supabase Auth).</li>
            <li>Payment log: Stripe events, refunds, disputes.</li>
            <li>Backup snapshots: managed on our cloud infrastructure, retained for point-in-time recovery.</li>
          </ul>
          <p>
            All evidence is preserved for the duration of any investigation and at least 12 months from breach
            closure.
          </p>

          <h2>6. Non-notifiable events</h2>
          <p>
            Where a breach is unlikely to result in a risk to rights and freedoms, it will still be recorded in
            the internal breach register with reasoning, in line with Art. 33(5).
          </p>

          <h2>7. Testing &amp; review</h2>
          <p>
            The procedure is table-top tested at least once every 12 months, and reviewed on any material change
            to the platform, sub-processors, or applicable law.
          </p>

          <p className="mt-8 text-sm text-muted-foreground">
            See also: <Link to="/privacy" className="text-primary">Privacy Policy</Link> ·{" "}
            <Link to="/privacy/dpia" className="text-primary">Data Protection Impact Assessment</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
