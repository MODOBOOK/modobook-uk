import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { signUpFromWaitlist } from "@/lib/waitlist.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    as: s.as === "prescriber" ? "prescriber" : undefined,
    next: typeof s.next === "string" && s.next.startsWith("/") ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Create your account | MODO" },
      { name: "description", content: "Create your MODO practitioner account. Waitlist access only." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { as, next } = Route.useSearch();
  const isPrescriberFlow = as === "prescriber";
  const postAuthTo = () =>
    next
      ? ({ to: next } as any)
      : { to: isPrescriberFlow ? "/hub/verification" : "/dashboard" };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [signupName, setSignupName] = useState("");

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  const createAccount = useServerFn(signUpFromWaitlist);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
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

  async function handleOAuth(provider: "google" | "apple") {
    setLoading(true);
    const redirectUri = `${window.location.origin}/auth`;
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: redirectUri });
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message || `${provider === "apple" ? "Apple" : "Google"} sign in failed`);
      return;
    }
    if (result.redirected) return;
    router.navigate(postAuthTo());
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
            <CardTitle>Welcome to MODO</CardTitle>
            <CardDescription>
              {mode === "signin"
                ? "Sign in to your practitioner account."
                : "Create your account — available to clinics on the MODO waitlist."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(["signin", "signup"] as const).map((m) => (
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

            {mode === "signin" ? (
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
            ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Full name</Label>
                <Input id="signup-name" value={signupName} onChange={(e) => setSignupName(e.target.value)} placeholder="Jane Smith" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Waitlist email</Label>
                <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@clinic.co.uk" />
                <p className="text-xs text-muted-foreground">Use the same email you joined the waitlist with.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create my account
              </Button>
            </form>
            )}

            <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-center text-xs text-muted-foreground">
              Not on the waitlist yet? MODO is opening to new clinics in stages.{" "}
              <Link to="/waitlist" className="font-medium text-foreground underline underline-offset-2">
                Join the waitlist →
              </Link>
            </div>


            <Separator />

            <Button variant="outline" className="w-full" onClick={() => handleOAuth("google")} disabled={loading}>
              Continue with Google
            </Button>

            <Button variant="outline" className="w-full bg-black text-white hover:bg-black/90 hover:text-white" onClick={() => handleOAuth("apple")} disabled={loading}>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zM256.6 84.5c26.9-31.9 24.5-61 23.7-71.5-23.8 1.4-51.4 16.2-67.1 34.4-17.3 19.5-27.5 43.6-25.3 70.9 25.7 2 49.1-11.2 68.7-33.8z"/></svg>
              Continue with Apple
            </Button>

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
