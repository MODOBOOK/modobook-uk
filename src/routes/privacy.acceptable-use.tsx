import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/privacy/acceptable-use")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acceptable Use & Practitioner Data Duties | MODO" },
      {
        name: "description",
        content:
          "Acceptable use of the MODO platform and the data-protection responsibilities practitioners hold as Data Controllers for their patients.",
      },
      { property: "og:title", content: "Acceptable Use & Practitioner Data Duties | MODO" },
      {
        property: "og:description",
        content: "What practitioners must do as Data Controllers, and what MODO handles as Processor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AcceptableUsePage,
});

function AcceptableUsePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/"><BrandMark size="sm" /></Link>
          <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">← Privacy</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-serif text-4xl tracking-tight">Acceptable Use &amp; Practitioner Data Duties</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          MODO BOOKING PLATFORM · ICO registration <strong>C1994747</strong> · Applies to every clinic account
        </p>

        <div className="prose prose-neutral mt-8 max-w-none prose-h2:font-serif prose-h2:tracking-tight prose-a:text-primary">
          <h2>1. Who is responsible for what</h2>
          <table>
            <thead>
              <tr><th>Data</th><th>Data Controller</th><th>MODO's role</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Patient clinical records — medical forms, notes, consents, photos, prescriptions</td>
                <td>The treating practitioner / clinic</td>
                <td>Processor, acting only on the clinic's instructions</td>
              </tr>
              <tr>
                <td>Practitioner account, billing and subscription data</td>
                <td>MODO</td>
                <td>Controller</td>
              </tr>
              <tr>
                <td>Platform security, audit logs and abuse prevention</td>
                <td>MODO</td>
                <td>Controller</td>
              </tr>
              <tr>
                <td>Marketing a clinic sends to its own patients</td>
                <td>The clinic</td>
                <td>Processor (sending infrastructure)</td>
              </tr>
            </tbody>
          </table>
          <p>
            The processor terms that govern this split are in our{" "}
            <Link to="/privacy/dpa">Data Processing Agreement</Link>, which forms part of your
            subscription and is accepted when you create a clinic account.
          </p>

          <h2>2. Your duties as a Data Controller</h2>
          <ul>
            <li><strong>Register with the ICO.</strong> Clinics processing patient health data must maintain their own ICO registration and pay the data protection fee.</li>
            <li><strong>Publish your own privacy notice</strong> to patients, covering how your clinic uses their data. MODO's notice covers the platform, not your clinic's practices.</li>
            <li><strong>Obtain valid consent</strong> for treatment, for photographs, and separately for marketing. Never pre-tick a consent box.</li>
            <li><strong>Keep records accurate and current</strong>, and correct them promptly when a patient tells you they are wrong.</li>
            <li><strong>Respond to patient rights requests</strong> that come to you, within one calendar month.</li>
            <li><strong>Tell us within 24 hours</strong> if you become aware of a breach affecting data held in MODO, so we can meet the 72-hour ICO deadline together — see our <Link to="/privacy/breach-response">breach procedure</Link>.</li>
            <li><strong>Maintain professional indemnity and regulator registration</strong> appropriate to the treatments you deliver.</li>
          </ul>

          <h2>3. Account security you are responsible for</h2>
          <ul>
            <li>One login per person. Never share credentials — invite staff as their own users with the right role.</li>
            <li>Remove staff access on the day they leave.</li>
            <li>Use a strong, unique password. Passwords found in known breaches are rejected automatically.</li>
            <li>Lock or sign out of shared clinic devices; do not leave a patient record open on a treatment-room screen.</li>
            <li>Only give a staff member the access level their job needs.</li>
          </ul>

          <h2>4. Acceptable use</h2>
          <p>When using MODO you must not:</p>
          <ul>
            <li>Upload data about people who are not your patients, or records obtained without a lawful basis.</li>
            <li>Use patient contact details for marketing without a valid, recorded opt-in, or send marketing without an unsubscribe link.</li>
            <li>Upload identifiable patient photographs to social media or third-party tools without separate written consent.</li>
            <li>Attempt to access another clinic's data, probe or bypass platform security, or reverse-engineer the service.</li>
            <li>Use the platform to record or facilitate prescribing outside your legal scope of practice, or to issue prescriptions without an appropriate consultation.</li>
            <li>Upload malware, unlawful content, or content that infringes someone else's rights.</li>
            <li>Resell, sublicense or white-label the platform without a written agreement with us.</li>
            <li>Use real patient data in the demo environment.</li>
          </ul>

          <h2>5. What MODO does for you</h2>
          <ul>
            <li>Data stored at rest in the European Economic Area (Paris region), encrypted in transit and at rest.</li>
            <li>Strict clinic-level isolation — no clinic can read another clinic's records.</li>
            <li>Role-based access, audit logging of clinical record access, and daily backups.</li>
            <li>Secure one-time links for consents and medical forms, so health data is never sent in the body of an email.</li>
            <li>Full export of your clinic's records on request or on leaving.</li>
          </ul>

          <h2>6. Enforcement</h2>
          <p>
            Where we have reasonable grounds to believe this policy has been breached, we may suspend
            the account while we investigate, and in serious cases terminate it and report the matter
            to the ICO or the relevant professional regulator. We will always tell you what we have
            done and why, unless prevented by law. Suspended clinics retain the right to export their
            patient records.
          </p>

          <h2>7. Questions</h2>
          <p>
            Email <a href="mailto:info@modobook.co.uk">info@modobook.co.uk</a>. To challenge a decision
            under this policy, use our{" "}
            <Link to="/privacy/complaints">complaints procedure</Link>.
          </p>
        </div>

        <div className="mt-10 border-t pt-6 text-sm text-muted-foreground">
          See also: <Link to="/privacy" className="underline">Privacy Policy</Link>{" · "}
          <Link to="/privacy/dpa" className="underline">Data Processing Agreement</Link>{" · "}
          <Link to="/terms" className="underline">Terms &amp; Conditions</Link>
        </div>
      </main>
    </div>
  );
}
