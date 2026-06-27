import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Link2, Palette, ShieldCheck, CreditCard, Star } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MODO | Custom practitioner booking pages" },
      { name: "description", content: "Create a branded MODO booking page, manage treatments, consultations, and take payments with Stripe Connect." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Calendar className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Aesthetic Bookings</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link to="/auth">
              <Button>Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-4 py-20 text-center lg:px-8">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Your clinic. Your brand. Your bookings.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Build a custom booking page, define your own treatments, set live availability, and let patients pay directly into your Stripe account.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/auth">
              <Button size="lg">Create your page</Button>
            </Link>
            <Link to="/demo-clinic">
              <Button size="lg" variant="outline">
                See a demo
              </Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <Palette className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>Customisable clinic page</CardTitle>
                <CardDescription>Brand colours, hero image, gallery, testimonials, and contact details.</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Link2 className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>Your own booking link</CardTitle>
                <CardDescription>Share a simple URL like /book/your-clinic for patients to book 24/7.</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <ShieldCheck className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>Consent forms</CardTitle>
                <CardDescription>Upload consent forms and collect signatures before each appointment.</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CreditCard className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>Payments in your Stripe</CardTitle>
                <CardDescription>Connect your own Stripe account. 0% platform fee. Optional Klarna & Clearpay.</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Calendar className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>Preset live slots</CardTitle>
                <CardDescription>Set weekly availability and block holidays so patients only book real openings.</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Star className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>Packages & consultations</CardTitle>
                <CardDescription>Sell treatment packages, credit bundles, and paid consultations.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="border-t bg-muted/50">
          <div className="mx-auto max-w-7xl px-4 py-12 text-center lg:px-8">
            <h2 className="text-2xl font-semibold tracking-tight">Ready to simplify your bookings?</h2>
            <p className="mt-2 text-muted-foreground">Join practitioners using Aesthetic Bookings for their clinic.</p>
            <div className="mt-6">
              <Link to="/auth">
                <Button size="lg">Get started free</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Aesthetic Bookings. Built for practitioners.
      </footer>
    </div>
  );
}
