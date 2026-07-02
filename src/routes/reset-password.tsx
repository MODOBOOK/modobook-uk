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
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase emits PASSWORD_RECOVERY when the recovery link is opened.
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("type=recovery")) setRecovery(true);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setReady(true);
    });
    // Also check current session
    supabase.auth.getSession().then(() => setReady(true));
    return () => sub.subscription.unsubscribe();
  }, []);

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
