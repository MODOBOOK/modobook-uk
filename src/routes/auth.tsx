import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { fetchActiveTerms, recordTermsAcceptance } from "@/lib/platform-terms";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    as: s.as === "prescriber" ? "prescriber" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in | MODO" },
      { name: "description", content: "Sign in to your MODO account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { as } = Route.useSearch();
  const isPrescriberFlow = as === "prescriber";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);


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


  async function handleGoogle() {
    setLoading(true);
    const redirectUri = `${window.location.origin}/auth`;
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: redirectUri });
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message || "Google sign in failed");
      return;
    }
    if (result.redirected) {
      return;
    }
    router.navigate({ to: isPrescriberFlow ? "/hub/verification" : "/dashboard" });
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    router.navigate({ to: isPrescriberFlow ? "/hub/verification" : "/dashboard" });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptTerms) {
      toast.error("Please accept the Terms & Conditions to create your account.");
      return;
    }
    setLoading(true);
    // Snapshot active terms *before* signup so we know which version to record.
    let activeTermsId: string | null = null;
    try {
      const active = await fetchActiveTerms();
      activeTermsId = active?.id ?? null;
    } catch {
      /* non-fatal — gate will re-prompt on first dashboard entry */
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    // If session was created immediately (email confirmations off), record acceptance now.
    if (data.session && activeTermsId) {
      try {
        await recordTermsAcceptance(activeTermsId, "signup");
      } catch {
        /* gate will re-prompt if this failed */
      }
    }
    setLoading(false);
    if (isPrescriberFlow) {
      toast.success("Account created. Submit your verification next.");
      router.navigate({ to: "/hub/verification" });
    } else {
      toast.success("Account created. Complete your clinic profile next.");
      router.navigate({ to: "/onboarding" });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center">
          <BrandMark size="lg" />
        </div>

        <Tabs defaultValue={isPrescriberFlow ? "signup" : "signin"}>
          <Card>
            <CardHeader className="text-center">
              <CardTitle>{isPrescriberFlow ? "Prescriber sign up" : "Welcome"}</CardTitle>
              <CardDescription>
                {isPrescriberFlow
                  ? "Create an account, then submit your verification (registration body, PIN, photo ID)."
                  : "Sign in or create a new practitioner account."}
              </CardDescription>
            </CardHeader>
            <TabsList className="mx-6 grid w-[calc(100%-3rem)] grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <CardContent className="space-y-4 pt-4">
              <TabsContent value="signin" className="mt-0">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
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

              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create account
                  </Button>
                </form>
              </TabsContent>

              <Separator />

              <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
                Continue with Google
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                By signing in, you agree to our{" "}
                <Link to="/" className="underline">
                  terms
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </div>
  );
}
