import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/privacy/cookies")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cookie Policy | MODO" },
      {
        name: "description",
        content:
          "Which cookies MODO sets, why they are needed, how long they last and how to control them under PECR and UK GDPR.",
      },
      { property: "og:title", content: "Cookie Policy | MODO" },
      {
        property: "og:description",
        content: "The cookies and local storage MODO uses, and how to control them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CookiePolicyPage,
});

function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/"><BrandMark size="sm" /></Link>
          <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">← Privacy</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-serif text-4xl tracking-tight">Cookie Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          MODO BOOKING PLATFORM · ICO registration <strong>C1994747</strong> · Privacy and Electronic
          Communications Regulations (PECR) &amp; UK GDPR
        </p>

        <div className="prose prose-neutral mt-8 max-w-none prose-h2:font-serif prose-h2:tracking-tight prose-a:text-primary">
          <h2>1. Our approach</h2>
          <p>
            MODO runs on <strong>strictly necessary cookies and local storage only</strong>. We do not
            use advertising cookies, cross-site tracking pixels, or third-party ad networks, and we
            do not sell or share browsing data. Strictly necessary cookies do not require consent
            under PECR, but we list them here so you know exactly what is stored on your device.
          </p>

          <h2>2. What we store</h2>
          <table>
            <thead>
              <tr>
                <th>Name / type</th>
                <th>Purpose</th>
                <th>Lifetime</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Authentication session token (browser local storage)</td>
                <td>Keeps you signed in to your practitioner dashboard or patient account and refreshes your session securely.</td>
                <td>Until sign-out or token expiry</td>
                <td>Strictly necessary</td>
              </tr>
              <tr>
                <td>Cookie banner acknowledgement</td>
                <td>Remembers that you have seen and dismissed the cookie notice so it is not shown on every page.</td>
                <td>12 months</td>
                <td>Strictly necessary</td>
              </tr>
              <tr>
                <td>Interface preferences</td>
                <td>Remembers layout choices such as sidebar collapse, calendar view and selected clinic location.</td>
                <td>Until cleared</td>
                <td>Strictly necessary</td>
              </tr>
              <tr>
                <td>Booking progress</td>
                <td>Holds an in-progress booking (treatment, date, add-ons) so a refresh does not lose your place.</td>
                <td>Session</td>
                <td>Strictly necessary</td>
              </tr>
              <tr>
                <td>Stripe payment cookies</td>
                <td>Set by Stripe on their hosted checkout to process your payment and prevent card fraud.</td>
                <td>Set by Stripe (see their notice)</td>
                <td>Strictly necessary</td>
              </tr>
              <tr>
                <td>Push notification subscription</td>
                <td>Stored only if you opt in to appointment push notifications, to identify your device.</td>
                <td>Until you turn notifications off</td>
                <td>Consent-based (opt-in)</td>
              </tr>
            </tbody>
          </table>

          <h2>3. What we do not use</h2>
          <ul>
            <li>No Google Analytics, Meta Pixel, TikTok Pixel or similar advertising trackers.</li>
            <li>No cross-site profiling or behavioural advertising.</li>
            <li>No cookies that read or transmit health data. Clinical information is only ever
              retrieved from our servers after you authenticate.</li>
          </ul>
          <p>
            If we ever introduce optional analytics, it will be off by default and only enabled
            after you give consent through the on-screen banner. This page will be updated first.
          </p>

          <h2>4. Third parties</h2>
          <p>
            The only third party that can set cookies during a MODO journey is <strong>Stripe</strong>,
            when you are taken to their secure checkout to pay a deposit or balance. Stripe uses
            these for payment processing and fraud prevention — see the{" "}
            <a href="https://stripe.com/cookies-policy/legal" target="_blank" rel="noreferrer">Stripe cookie policy</a>.
          </p>

          <h2>5. Controlling cookies</h2>
          <ul>
            <li>You can clear or block cookies and site data in your browser settings at any time.</li>
            <li>Blocking strictly necessary cookies will sign you out and may stop bookings, forms and consents from working.</li>
            <li>Push notifications can be turned off at any time from your account settings or your browser/device notification settings.</li>
          </ul>

          <h2>6. Questions or complaints</h2>
          <p>
            Email <a href="mailto:info@modobook.co.uk">info@modobook.co.uk</a>. You can also complain
            to the Information Commissioner's Office —{" "}
            <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">ico.org.uk/make-a-complaint</a>{" "}
            or 0303 123 1113. See our{" "}
            <Link to="/privacy/complaints">complaints &amp; subject-access procedure</Link>.
          </p>
        </div>

        <div className="mt-10 border-t pt-6 text-sm text-muted-foreground">
          See also: <Link to="/privacy" className="underline">Privacy Policy</Link>{" · "}
          <Link to="/privacy/retention" className="underline">Data Retention Schedule</Link>{" · "}
          <Link to="/privacy/complaints" className="underline">Complaints &amp; SAR</Link>
        </div>
      </main>
    </div>
  );
}
