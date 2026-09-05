import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { signUpFromWaitlist } from "@/lib/waitlist.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchActiveTerms, recordTermsAcceptance } from "@/lib/platform-terms";
import { captureReferralFromUrl, getStoredReferral, storeReferral } from "@/lib/referral-capture";
import { Gift } from "lucide-react";


import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { as?: "prescriber"; next?: string; email?: string } => ({
    as: s.as === "prescriber" ? "prescriber" : undefined,
    next: typeof s.next === "string" && s.next.startsWith("/") ? s.next : undefined,
    email: typeof s.email === "string" ? s.email : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Create your account | MODO" },
      { name: "description", content: "Create your MODO practitioner account — first month free, no card details required." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { as, next, email: prefillEmail } = Route.useSearch();
  const isPrescriberFlow = as === "prescriber";
  const postAuthTo = () =>
    next
      ? ({ to: next } as any)
      : { to: isPrescriberFlow ? "/hub/verification" : "/dashboard" };
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [password, setPassword] = useState("");

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [signupName, setSignupName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  useEffect(() => {
    const stored = captureReferralFromUrl() ?? getStoredReferral();
    if (stored) setReferralCode(stored);
  }, []);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  const createAccount = useServerFn(signUpFromWaitlist);


  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (!acceptedTerms) { toast.error("Please accept the Terms & Conditions to continue."); return; }
    setLoading(true);
    try {
      const res = await createAccount({ data: { email, password, name: signupName || null } });
      if (!res.ok) {
        setLoading(false);
        toast.error(res.error);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      try {
        const active = await fetchActiveTerms();
        if (active) await recordTermsAcceptance(active.id, "signup");
      } catch {
        // acceptance is re-prompted by the in-app gate if this fails
      }
      toast.success("Welcome to MODO");
      router.navigate(postAuthTo());
    } catch (err) {
      setLoading(false);
      toast.error("Could not create your account. Please try again.");
    }
  }


  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("If an account exists, we've sent a reset link.");
    setForgotOpen(false);
  }


  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    router.navigate(postAuthTo());
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center">
          <BrandMark size="lg" />
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Create your MODO account</CardTitle>
            <CardDescription>
              {mode === "signin"
                ? "Sign in to your practitioner account."
                : "Open to all aesthetics practitioners — first month free, no card details required."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(["signup", "signin"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            {mode === "signup" ? (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Full name</Label>
                <Input id="signup-name" value={signupName} onChange={(e) => setSignupName(e.target.value)} placeholder="Jane Smith" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Work email</Label>
                <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@clinic.co.uk" />
                <p className="text-xs text-muted-foreground">Your first month is free — no card details needed.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-ref" className="flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5 text-primary" /> Referral code <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="signup-ref"
                  value={referralCode}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase();
                    setReferralCode(v);
                    storeReferral(v);
                  }}
                  placeholder="e.g. AESTHETICSB25"
                  className="uppercase"
                  autoComplete="off"
                />
                {referralCode.trim() && (
                  <p className="text-xs text-primary">Referred — 25% off your first 3 paid months will apply automatically.</p>
                )}
              </div>
              <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
                <Checkbox
                  checked={acceptedTerms}
                  onCheckedChange={(v) => setAcceptedTerms(Boolean(v))}
                  className="mt-0.5"
                />
                <span>
                  I have read and accept the{" "}
                  <Link to="/terms" target="_blank" className="font-medium text-foreground underline underline-offset-2">
                    Terms &amp; Conditions
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" target="_blank" className="font-medium text-foreground underline underline-offset-2">
                    Privacy Policy
                  </Link>.
                </span>
              </label>
              <Button type="submit" className="w-full" disabled={loading || !acceptedTerms}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create my account
              </Button>

            </form>
            ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign in
              </Button>
              <button
                type="button"
                className="block w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => { setForgotOpen((v) => !v); setForgotEmail(email); }}
              >
                Forgot password?
              </button>
              {forgotOpen && (
                <div className="rounded-md border bg-muted/40 p-3">
                  <Label htmlFor="forgot-email" className="text-xs">Send a reset link to</Label>
                  <div className="mt-1 flex gap-2">
                    <Input id="forgot-email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@example.com" />
                    <Button type="button" size="sm" onClick={handleForgot} disabled={loading || !forgotEmail}>Send</Button>
                  </div>
                </div>
              )}
            </form>
            )}

            <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-center text-xs text-muted-foreground">
              MODO is now open to every aesthetics practitioner. Your first month is free
              and we don&rsquo;t ask for card details to start. Questions?{" "}
              <a
                href="mailto:info@modobook.co.uk"
                className="font-medium text-foreground underline underline-offset-2"
              >
                Email us →
              </a>
            </div>




            <p className="text-center text-xs text-muted-foreground">
              By continuing you agree to our{" "}
              <Link to="/terms" className="underline">Terms &amp; Conditions</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
