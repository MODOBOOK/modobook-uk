import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/privacy")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Privacy Policy | MODO" },
      {
        name: "description",
        content:
          "How MODO collects, uses and protects personal and health data under UK GDPR and the Data Protection Act 2018.",
      },
      { property: "og:title", content: "Privacy Policy | MODO" },
      {
        property: "og:description",
        content: "How MODO protects personal and health data under UK GDPR and the Data Protection Act 2018.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://modobook.uk/privacy" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://modobook.uk/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/"><BrandMark size="sm" /></Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-serif text-4xl tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective 2 July 2026 · Governed by the laws of Scotland (UK GDPR &amp; Data Protection Act 2018)
        </p>
        <div className="mt-4 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <strong>MODO BOOKING PLATFORM</strong> is registered with the UK Information
          Commissioner's Office as a data controller — registration reference{" "}
          <strong>C1994747</strong>. You can verify this on the{" "}
          <a
            href="https://ico.org.uk/ESDWebPages/Search"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            ICO public register
          </a>
          , and you have the right to complain to the ICO at any time about how we handle your data.
        </div>

        <div className="prose prose-neutral mt-8 max-w-none prose-h2:font-serif prose-h2:tracking-tight prose-a:text-primary">
          <h2>1. Who we are</h2>
          <p>
            MODO ("we", "us", "the platform") is an aesthetics booking and clinical records
            platform operated by MODO BOOKING PLATFORM (Scotland), ICO registration
            <strong> C1994747</strong>. This notice explains how we process
            personal data for two groups of people:
          </p>
          <ul>
            <li><strong>Practitioners</strong> — clinicians and clinic staff who use MODO as a Data Controller for their patients.</li>
            <li><strong>Patients</strong> — individuals who book appointments through a practitioner's MODO booking page. For patient clinical data, the practitioner is the Data Controller and MODO acts as their Data Processor.</li>
          </ul>


          <h2>2. Data we collect</h2>
          <ul>
            <li><strong>Account & identity:</strong> name, email, phone, role, clinic address.</li>
            <li><strong>Booking data:</strong> appointment dates, treatments, packages, payments (via Stripe).</li>
            <li><strong>Special-category health data:</strong> medical history, allergies, pregnancy status, medications, consultation notes, consent signatures, prescriptions, aftercare responses, before/after photos where uploaded.</li>
            <li><strong>Communications:</strong> SMS/email confirmations, reminders, aftercare messages, review requests.</li>
            <li><strong>Technical:</strong> device, browser, IP, session cookies required to keep you signed in.</li>
          </ul>

          <h2>3. Lawful bases (UK GDPR Article 6 &amp; 9)</h2>
          <ul>
            <li><strong>Contract</strong> (Art. 6(1)(b)) — to deliver bookings, payments and clinical records you request.</li>
            <li><strong>Legal obligation</strong> (Art. 6(1)(c)) — to keep clinical, prescribing and financial records as required by UK law and professional regulators (NMC, GMC, GPhC, HMRC).</li>
            <li><strong>Explicit consent</strong> (Art. 9(2)(a)) — for processing health data, sending marketing, and storing before/after photos.</li>
            <li><strong>Vital interests</strong> (Art. 9(2)(c)) — to flag allergies and safety alerts during treatment.</li>
            <li><strong>Legitimate interests</strong> (Art. 6(1)(f)) — platform security, fraud prevention, service improvement (balanced against your rights).</li>
          </ul>

          <h2>4. Where your data is stored</h2>
          <p>
            <strong>All clinical data — including medical history forms,
            consultation notes, consent forms, prescriptions and any
            before/after or treatment photos — is stored at rest inside the
            European Economic Area</strong>, on our managed cloud infrastructure (Supabase / AWS
            <em> eu-west-3, Paris, France</em>). Databases and file storage
            (patient photos, consent PDFs, uploaded documents) never leave that
            EEA region under normal operation.
          </p>
          <p>
            <strong>Transactional and authentication emails</strong> — booking
            confirmations, reminders, medical-form and consent links,
            prescription receipts, one-time passcodes and password resets — are
            sent from <code>notify.modobook.co.uk</code> through our managed EU email relay. To protect health data in transit and at
            the provider, our emails contain only appointment metadata (date,
            time, treatment name, clinic) and secure one-time links back into
            MODO; <strong>we do not embed medical history answers, consultation
            notes, diagnoses, prescription contents or clinical photos in the
            body of an email</strong>.
          </p>
          <p>
            <strong>Payments</strong> are processed by Stripe (UK &amp;
            Ireland). Stripe receives only the information required to take a
            payment (name, email, amount, appointment reference) — never your
            clinical record. Any onward international transfer by a
            sub-processor relies on the UK International Data Transfer
            Addendum and EU Standard Contractual Clauses.
          </p>


          <h2>5. How long we keep data</h2>
          <ul>
            <li><strong>Clinical records</strong> (medical forms, consents, consultation notes, prescriptions, aftercare) — retained for a minimum of <strong>8 years after last treatment</strong>, or until a child patient reaches age 25, in line with NHS &amp; NMC guidance.</li>
            <li><strong>Prescription audit trail</strong> — 10 years.</li>
            <li><strong>Financial records</strong> (invoices, Stripe references) — 7 years (HMRC).</li>
            <li><strong>Marketing preferences &amp; suppression list</strong> — held indefinitely to honour opt-outs.</li>
            <li><strong>Account &amp; login logs</strong> — up to 24 months after account closure.</li>
          </ul>

          <h2>6. Your rights</h2>
          <p>Under UK GDPR you have the right to:</p>
          <ul>
            <li>Access a copy of your data (Subject Access Request).</li>
            <li>Have inaccurate data <strong>rectified</strong> — patients can edit name, contact and address details directly in their account.</li>
            <li>Request <strong>erasure</strong> where legally permitted (clinical records may be retained for the periods above).</li>
            <li>Request <strong>portability</strong> of data you provided in a machine-readable format.</li>
            <li>Object to or restrict processing, including marketing.</li>
            <li>Withdraw consent at any time (this does not affect processing already carried out).</li>
            <li>Complain to the Information Commissioner's Office (<a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">ico.org.uk/make-a-complaint</a>, 0303 123 1113), quoting our registration reference <strong>C1994747</strong>.</li>
          </ul>
          <p>
            To exercise any of these rights, email <a href="mailto:info@modobook.co.uk">info@modobook.co.uk</a>.
            We respond within one calendar month. Full details of how to raise a request or a
            complaint, and how to escalate to the ICO, are in our{" "}
            <Link to="/privacy/complaints">Complaints &amp; Subject Access procedure</Link>.
          </p>

          <h2>7. Cookies</h2>
          <p>
            We use only <strong>strictly necessary</strong> cookies to keep you signed in and remember
            layout preferences. We do not use advertising or cross-site tracking cookies.
            Optional analytics (if ever enabled) will be gated by the on-screen consent banner.
            A full list is in our <Link to="/privacy/cookies">Cookie Policy</Link>.
          </p>

          <h2>8. Security</h2>
          <ul>
            <li>Encryption in transit (TLS 1.2+) and at rest (AES-256).</li>
            <li>Row-Level Security so practitioners can only see their own patients.</li>
            <li>Role-based access control; passwords are securely hashed and checked against known-breach databases.</li>
            <li>Automatic daily backups.</li>
            <li>Signed URLs and short-lived tokens for consent, medical-form and cancellation links.</li>
          </ul>

          <h2>9. Sharing your data</h2>
          <p>
            We share data only with sub-processors necessary to run the service:
            managed EU cloud hosting &amp; database (AWS, Paris region), Stripe (payments), and the
            SMS/email providers used by your practitioner. We never sell personal data.
          </p>

          <h2>10. Complaints &amp; regulator</h2>
          <p>
            If you are unhappy with how we handle your data, email{" "}
            <a href="mailto:info@modobook.co.uk">info@modobook.co.uk</a> and we will acknowledge
            within 5 working days and respond within one calendar month. You can also complain
            directly to the ICO at any time — you do not have to come to us first:
          </p>
          <ul>
            <li><a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">ico.org.uk/make-a-complaint</a> · 0303 123 1113</li>
            <li>Information Commissioner's Office, Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF</li>
            <li>Our registration reference: <strong>C1994747</strong></li>
          </ul>

          <h2>11. Controller contact</h2>
          <p>
            <strong>Controller:</strong> MODO BOOKING PLATFORM, Scotland, United Kingdom (ICO reg. C1994747).<br />
            <strong>Data Protection contact:</strong> <a href="mailto:info@modobook.co.uk">info@modobook.co.uk</a>
            <br />
            For clinical data held about you as a patient, the practitioner who
            treated you is the Data Controller — contact them directly, or email us
            and we will route your request.
          </p>

          <h2>12. Changes to this notice</h2>
          <p>
            We update this notice when the platform or the law changes. The current
            version is always available at <Link to="/privacy">/privacy</Link>.
          </p>
        </div>

        <div className="mt-10 border-t pt-6 text-sm text-muted-foreground">
          See also:{" "}
          <Link to="/privacy/cookies" className="underline">Cookie Policy</Link>
          {" · "}
          <Link to="/privacy/retention" className="underline">Data Retention Schedule</Link>
          {" · "}
          <Link to="/privacy/complaints" className="underline">Complaints &amp; Subject Access</Link>
          {" · "}
          <Link to="/privacy/acceptable-use" className="underline">Acceptable Use &amp; Practitioner Duties</Link>
          {" · "}
          <Link to="/privacy/dpa" className="underline">Data Processing Agreement</Link>
          {" · "}
          <Link to="/privacy/dpia" className="underline">Data Protection Impact Assessment</Link>
          {" · "}
          <Link to="/privacy/breach-response" className="underline">Breach Response Procedure</Link>
          {" · "}
          <Link to="/terms" className="underline">Terms &amp; Conditions</Link>.
        </div>


      </main>
    </div>
  );
}
