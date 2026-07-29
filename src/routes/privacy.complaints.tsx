import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/privacy/complaints")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Complaints & Subject Access Requests | MODO" },
      {
        name: "description",
        content:
          "How to make a data-protection complaint or subject access request to MODO, our response timescales, and how to escalate to the ICO.",
      },
      { property: "og:title", content: "Complaints & Subject Access Requests | MODO" },
      {
        property: "og:description",
        content: "Raise a data-protection complaint or request your data from MODO, and escalate to the ICO.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComplaintsPage,
});

function ComplaintsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/"><BrandMark size="sm" /></Link>
          <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">← Privacy</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-serif text-4xl tracking-tight">Complaints &amp; Subject Access Requests</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          MODO BOOKING PLATFORM · ICO registration <strong>C1994747</strong> · UK GDPR Art. 12–22
        </p>

        <div className="prose prose-neutral mt-8 max-w-none prose-h2:font-serif prose-h2:tracking-tight prose-a:text-primary">
          <h2>1. Who to contact first</h2>
          <p>
            <strong>If your complaint or request is about your clinical record</strong> — medical
            forms, consultation notes, consent forms, photographs, prescriptions — the clinic or
            practitioner who treated you is the Data Controller. Contact them first. If you cannot
            reach them, or your complaint is about them, contact us and we will route it or act
            where we are permitted to.
          </p>
          <p>
            <strong>If your complaint or request is about the MODO platform itself</strong> — your
            login, account data, emails we send, security, or how the platform handles data —
            contact us directly.
          </p>
          <p>
            <strong>Data protection contact:</strong>{" "}
            <a href="mailto:info@modobook.co.uk">info@modobook.co.uk</a><br />
            <strong>Controller:</strong> MODO BOOKING PLATFORM, Scotland, United Kingdom<br />
            <strong>ICO registration reference:</strong> C1994747
          </p>

          <h2>2. Making a Subject Access Request (SAR)</h2>
          <p>Email us with:</p>
          <ul>
            <li>Your full name, date of birth and the email or phone number linked to your account.</li>
            <li>The clinic you attended, if your request concerns treatment records.</li>
            <li>What you want — everything, or a specific period, treatment or document type.</li>
            <li>The format you want it in (PDF pack or machine-readable export).</li>
          </ul>
          <p>
            A SAR is <strong>free</strong>. We may ask for proof of identity before releasing health
            data — that is a safeguard for you, and the clock starts once we have it.
          </p>

          <h2>3. Timescales</h2>
          <table>
            <thead>
              <tr><th>Stage</th><th>Timescale</th></tr>
            </thead>
            <tbody>
              <tr><td>Acknowledge your request or complaint</td><td>Within 5 working days</td></tr>
              <tr><td>Verify identity (if needed)</td><td>Within 5 working days of acknowledgement</td></tr>
              <tr><td>Full response to a SAR or rights request</td><td>Within 1 calendar month</td></tr>
              <tr><td>Extension for complex or multiple requests</td><td>Up to 2 further months — we will tell you why within the first month</td></tr>
              <tr><td>Complaint outcome</td><td>Within 1 calendar month</td></tr>
              <tr><td>Breach notification to affected people (where high risk)</td><td>Without undue delay — see our <Link to="/privacy/breach-response">breach procedure</Link></td></tr>
            </tbody>
          </table>

          <h2>4. Other rights you can exercise the same way</h2>
          <ul>
            <li><strong>Rectification</strong> — correct inaccurate details. Patients can edit name, contact and address in their account instantly.</li>
            <li><strong>Erasure</strong> — deletion of anything not required by a legal, clinical or financial retention period (see the <Link to="/privacy/retention">retention schedule</Link>).</li>
            <li><strong>Portability</strong> — a machine-readable export of data you provided.</li>
            <li><strong>Restriction or objection</strong> — pause processing while a dispute is resolved, or object to a use based on legitimate interests.</li>
            <li><strong>Withdraw consent</strong> — for marketing, photographs or optional processing, at any time and without affecting your care.</li>
          </ul>

          <h2>5. If you are unhappy with our response</h2>
          <ol>
            <li>Reply and ask for an internal review — a second person will look at it fresh.</li>
            <li>If still unresolved, you can complain to the <strong>Information Commissioner's Office</strong>:
              <ul>
                <li><a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">ico.org.uk/make-a-complaint</a></li>
                <li>Helpline 0303 123 1113</li>
                <li>Information Commissioner's Office, Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF</li>
              </ul>
            </li>
            <li>You can complain to the ICO at any time — you do not have to come to us first, and doing so does not affect your right to a legal remedy.</li>
          </ol>
          <p>
            Complaints about clinical care (rather than data) should go to the practitioner's
            professional regulator — the NMC, GMC, GPhC or GDC — or to Healthcare Improvement
            Scotland / the CQC where the clinic is registered.
          </p>

          <h2>6. Our commitment</h2>
          <ul>
            <li>We never charge for a first request, and never require a solicitor.</li>
            <li>We will not restrict your care or your account because you raised a complaint.</li>
            <li>Every request is logged, with the outcome and reasoning recorded for accountability.</li>
          </ul>
        </div>

        <div className="mt-10 border-t pt-6 text-sm text-muted-foreground">
          See also: <Link to="/privacy" className="underline">Privacy Policy</Link>{" · "}
          <Link to="/privacy/retention" className="underline">Retention Schedule</Link>{" · "}
          <Link to="/privacy/breach-response" className="underline">Breach Response</Link>
        </div>
      </main>
    </div>
  );
}
