import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  adminOverview,
  adminGrantByEmail,
  adminRevoke,
  adminDeleteInvite,
  amIAdmin,
} from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Trash2, UserPlus, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  loader: async () => {
    const me = await amIAdmin();
    if (!me.admin) throw new Error("You do not have admin access.");
    return adminOverview();
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-md p-6 text-center">
      <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Admin only</h1>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  component: AdminPage,
});

type Practitioner = {
  profile_id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  clinic_name: string | null;
  slug: string | null;
  active: boolean;
  created_at: string;
  appointments_count: number;
  treatments_count: number;
};
type Admin = { user_id: string; email: string | null; created_at: string };
type Invite = { id: string; email: string; accepted_at: string | null; created_at: string };

function AdminPage() {
  const router = useRouter();
  const data = Route.useLoaderData();
  const practitioners = data.practitioners as Practitioner[];
  const admins = data.admins as Admin[];
  const invites = data.invites as Invite[];

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function invite() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const r = await adminGrantByEmail({ data: { email: email.trim() } });
      toast.success(
        r.status === "granted"
          ? "Admin access granted."
          : "User not found yet — they'll become admin when they sign up.",
      );
      setEmail("");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(user_id: string, label: string) {
    if (!confirm(`Remove admin access for ${label}?`)) return;
    try {
      await adminRevoke({ data: { user_id } });
      toast.success("Removed");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function dropInvite(id: string) {
    try {
      await adminDeleteInvite({ data: { id } });
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Platform admin</h1>
        <p className="text-sm text-muted-foreground">
          Monitor practitioners using MODO and manage admin access.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Practitioners" value={practitioners.length} />
        <Stat
          label="Active"
          value={practitioners.filter((p) => p.active).length}
        />
        <Stat
          label="Total bookings"
          value={practitioners.reduce((n, p) => n + Number(p.appointments_count || 0), 0)}
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Practitioners</CardTitle></CardHeader>
        <CardContent className="p-0">
          {practitioners.length === 0 ? (
            <p className="p-4 text-sm italic text-muted-foreground">No practitioners yet.</p>
          ) : (
            <div className="divide-y">
              {practitioners.map((p) => (
                <div key={p.profile_id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {p.clinic_name || p.full_name || "—"}
                      </span>
                      {!p.active && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.email} · {p.appointments_count} bookings · {p.treatments_count} treatments
                    </div>
                  </div>
                  {p.slug && (
                    <a
                      href={`/m/${p.slug}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      /m/{p.slug} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Add an admin</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Enter an email. If they have an account they get admin access immediately;
            otherwise they get it automatically when they sign up.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              placeholder="person@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") invite(); }}
            />
            <Button onClick={invite} disabled={busy}>
              <UserPlus className="mr-1 h-4 w-4" /> Add admin
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Current admins</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {admins.map((a) => (
              <div key={a.user_id} className="flex items-center justify-between gap-2 p-3">
                <div>
                  <div className="font-medium">{a.email}</div>
                  <div className="text-xs text-muted-foreground">
                    Since {new Date(a.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => revoke(a.user_id, a.email ?? "this admin")}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {invites.filter((i) => !i.accepted_at).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Pending invites</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {invites.filter((i) => !i.accepted_at).map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 p-3">
                  <div className="text-sm">{i.email}</div>
                  <Button variant="ghost" size="icon" onClick={() => dropInvite(i.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
