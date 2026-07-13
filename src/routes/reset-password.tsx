import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandMark } from "@/components/BrandMark";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Search = { slug?: string };

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    slug: typeof s.slug === "string" ? s.slug : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Reset password | MODO" },
      { name: "description", content: "Set a new password for your MODO account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { slug } = Route.useSearch();
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });

    async function bootstrap() {
      try {
        const url = new URL(window.location.href);
        const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
        const hashParams = new URLSearchParams(hash);
        const search = url.searchParams;

        // 1) Error from Supabase (expired/invalid link)
        const errCode = search.get("error_code") || hashParams.get("error_code");
        const errDesc = search.get("error_description") || hashParams.get("error_description");
        if (errCode || errDesc) {
          setLinkError(
            errCode === "otp_expired"
              ? "This reset link has expired. Request a new one from the sign-in page."
              : (errDesc?.replace(/\+/g, " ") ?? "This reset link is invalid or has expired."),
          );
          return;
        }

        // 2) PKCE flow: ?code=...
        const code = search.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setLinkError(error.message);
            return;
          }
          if (!cancelled) setRecovery(true);
          // Clean the URL
          window.history.replaceState({}, "", url.pathname + (slug ? `?slug=${encodeURIComponent(slug)}` : ""));
          return;
        }

        // 3) token_hash flow: ?token_hash=...&type=recovery
        const tokenHash = search.get("token_hash") || hashParams.get("token_hash");
        const type = search.get("type") || hashParams.get("type");
        if (tokenHash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          if (error) {
            setLinkError(error.message);
            return;
          }
          if (!cancelled) setRecovery(true);
          window.history.replaceState({}, "", url.pathname + (slug ? `?slug=${encodeURIComponent(slug)}` : ""));
          return;
        }

        // 4) Implicit flow: #access_token=...&type=recovery
        if (hashParams.get("type") === "recovery") {
          if (!cancelled) setRecovery(true);
          return;
        }

        // 5) Already-recovered session (e.g. detectSessionInUrl already handled it)
        const { data } = await supabase.auth.getSession();
        if (data.session) setRecovery(true);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, [slug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDone(true);
    toast.success("Password updated");
  }

  function onContinue() {
    if (slug) {
      navigate({ to: "/m/$slug/account", params: { slug } });
    } else {
      navigate({ to: "/dashboard" });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center">
          <BrandMark size="lg" />
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Reset password</CardTitle>
            <CardDescription>
              {done
                ? "Your password has been updated."
                : linkError
                  ? linkError
                  : recovery
                    ? "Choose a new password for your account."
                    : "Open the reset link from your email to continue."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!ready ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : done ? (
              <Button className="w-full" onClick={onContinue}>Continue</Button>
            ) : linkError ? (
              <Button className="w-full" onClick={() => navigate({ to: "/auth" })}>Back to sign in</Button>
            ) : recovery ? (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pw">New password</Label>
                  <Input id="pw" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw2">Confirm password</Label>
                  <Input id="pw2" type="password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Update password
                </Button>
              </form>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                This page is opened from the password-reset email link. If you got here by mistake,
                request a new link from the sign-in page.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
