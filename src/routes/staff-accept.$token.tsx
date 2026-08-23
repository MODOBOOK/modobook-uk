import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Mail } from "lucide-react";
import { getStaffInvite, acceptStaffInvite } from "@/lib/staff.functions";

export const Route = createFileRoute("/staff-accept/$token")({
  ssr: false,
  component: AcceptInvitePage,
  head: () => ({ meta: [{ title: "Accept invite · MODO Book" }] }),
});

type InviteState =
  | { status: "loading" }
  | { status: "invalid"; reason: "not_found" | "used" | "expired" }
  | { status: "ok"; name: string; email: string; role: string; clinicName: string };

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const lookup = useServerFn(getStaffInvite);
  const accept = useServerFn(acceptStaffInvite);

  const [state, setState] = useState<InviteState>({ status: "loading" });
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await lookup({ data: { token } });
      if (!res.ok) setState({ status: "invalid", reason: res.reason });
      else setState({ status: "ok", name: res.name, email: res.email ?? "", role: res.role, clinicName: res.clinicName });
      const { data } = await supabase.auth.getUser();
      setSessionEmail(data.user?.email ?? null);
    })();
  }, [token]);

  async function acceptAsCurrentUser() {
    setWorking(true);
    try {
      await accept({ data: { token } });
      toast.success("Invite accepted!");
      navigate({ to: "/dashboard" });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setWorking(false); }
  }
  async function createAccountAndAccept() {
    if (state.status !== "ok") return;
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    setWorking(true);
    try {
      const { error: signUpErr } = await supabase.auth.signUp({
        email: state.email, password,
        options: { emailRedirectTo: `${window.location.origin}/staff-accept/${token}` },
      });
      if (signUpErr) {
        // If the address already has an account, do NOT silently sign them in —
        // that has caused confusion (users think they made a fresh account and
        // ended up back in their existing one). Send them through /auth instead.
        if (/already|registered|exists/i.test(signUpErr.message)) {
          toast.info("An account already exists for this email — sign in to link the invite.");
          navigate({ to: "/auth", search: { next: `/staff-accept/${token}` } as any });
          return;
        }
        throw signUpErr;
      }
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: state.email, password });
      if (signInErr) throw signInErr;
      await accept({ data: { token } });
      toast.success(`Welcome to ${state.clinicName}!`);
      navigate({ to: "/dashboard" });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setWorking(false); }
  }


  if (state.status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading invite…</div>;
  }
  if (state.status === "invalid") {
    const msg = state.reason === "expired" ? "This invite has expired." :
                state.reason === "used" ? "This invite has already been used." :
                "This invite link isn't valid.";
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="items-center text-center">
            <XCircle className="h-10 w-10 text-destructive mb-2" />
            <CardTitle>Invite unavailable</CardTitle>
            <CardDescription>{msg} Ask the clinic to send a new invite.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild variant="outline"><Link to="/">Back to home</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const emailMatches = sessionEmail && sessionEmail.toLowerCase() === state.email.toLowerCase();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="max-w-md w-full">
        <CardHeader className="items-center text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
            <Mail className="h-6 w-6" />
          </div>
          <CardTitle>Join {state.clinicName}</CardTitle>
          <CardDescription>
            You've been invited as <strong>{state.role}</strong> for <strong>{state.email}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessionEmail && emailMatches ? (
            <>
              <p className="text-sm text-center text-muted-foreground">
                You're signed in as {sessionEmail}. Accept to join the team.
              </p>
              <Button className="w-full" onClick={acceptAsCurrentUser} disabled={working}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {working ? "Accepting…" : "Accept invite"}
              </Button>
            </>
          ) : sessionEmail && !emailMatches ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive text-center">
                You're signed in as {sessionEmail}, but this invite is for {state.email}. Sign out and use the invited email.
              </p>
              <Button variant="outline" className="w-full" onClick={async () => { await supabase.auth.signOut(); setSessionEmail(null); }}>
                Sign out
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                Already have a MODO account with this email?{" "}
                <button
                  type="button"
                  className="underline font-medium text-foreground"
                  onClick={() => navigate({ to: "/auth", search: { next: `/staff-accept/${token}` } as any })}
                >
                  Sign in instead
                </button>{" "}
                to link this invite to your existing account.
              </div>
              <div>
                <Label>Email</Label>
                <Input value={state.email} disabled />
              </div>
              <div>
                <Label>Set a password (new account)</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div>
                <Label>Confirm password</Label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
              </div>
              <Button className="w-full" onClick={createAccountAndAccept} disabled={working}>
                {working ? "Creating account…" : "Create account & accept"}
              </Button>
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
