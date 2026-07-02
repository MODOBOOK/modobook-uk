import { createFileRoute, useParams, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensurePatient } from "@/lib/patient.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type Search = { tab?: "signup" | "signin"; redirect?: string };

export const Route = createFileRoute("/m/$slug/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: s.tab === "signup" || s.tab === "signin" ? s.tab : undefined,
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: PatientAuth,
});

function PatientAuth() {
  const { slug } = useParams({ from: "/m/$slug/auth" });
  const search = useSearch({ from: "/m/$slug/auth" });
  const navigate = useNavigate();
  const ensure = useServerFn(ensurePatient);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    const target = forgotEmail || loginEmail;
    if (!target) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/reset-password?slug=${encodeURIComponent(slug)}`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("If an account exists, we've sent a reset link.");
    setForgotOpen(false);
  }


  function goAfterAuth() {
    if (search.redirect && search.redirect.startsWith("/")) {
      window.location.assign(search.redirect);
    } else {
      navigate({ to: "/m/$slug/account", params: { slug } });
    }
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}${search.redirect ?? `/m/${slug}/account`}` },
      });
      if (error) throw error;
      await ensure({ data: { fullName: name, phone, linkSlug: slug } });
      toast.success("Account created");
      goAfterAuth();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
      if (error) throw error;
      await ensure({ data: { fullName: loginEmail.split("@")[0], linkSlug: slug } });
      goAfterAuth();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Patient sign in</h1>
      <Tabs defaultValue={search.tab ?? "signin"}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Create account</TabsTrigger>
        </TabsList>
        <TabsContent value="signin" className="space-y-3 pt-4">
          <form onSubmit={signIn} className="space-y-3">
            <div><Label>Email</Label><Input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required /></div>
            <div><Label>Password</Label><Input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
            <button
              type="button"
              className="block w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => { setForgotOpen((v) => !v); setForgotEmail(loginEmail); }}
            >
              Forgot password?
            </button>
            {forgotOpen && (
              <div className="rounded-md border bg-muted/40 p-3">
                <Label className="text-xs">Send a reset link to</Label>
                <div className="mt-1 flex gap-2">
                  <Input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@example.com" />
                  <Button type="button" size="sm" onClick={sendReset} disabled={loading || !forgotEmail}>Send</Button>
                </div>
              </div>
            )}
          </form>
        </TabsContent>

        <TabsContent value="signup" className="space-y-3 pt-4">
          <form onSubmit={signUp} className="space-y-3">
            <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><Label>Phone (optional)</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
          </form>
        </TabsContent>
      </Tabs>
    </main>
  );
}
