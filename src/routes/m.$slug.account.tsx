import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyPatient, getMyPatientLinks, ensurePatient } from "@/lib/patient.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/m/$slug/account")({
  ssr: false,
  component: Account,
});

function Account() {
  const { slug } = useParams({ from: "/m/$slug/account" });
  const navigate = useNavigate();
  const getPatient = useServerFn(getMyPatient);
  const getLinks = useServerFn(getMyPatientLinks);
  const ensure = useServerFn(ensurePatient);
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<{ full_name: string; email: string | null } | null>(null);
  const [links, setLinks] = useState<Array<{ profiles: { slug: string; clinic_name: string | null; full_name: string | null } | null }>>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({ to: "/m/$slug/auth", params: { slug } });
        return;
      }
      const p = await getPatient();
      if (!p.patient) {
        await ensure({ data: { fullName: data.session.user.email?.split("@")[0] ?? "Patient", linkSlug: slug } });
      } else {
        setPatient(p.patient);
      }
      const l = await getLinks();
      setLinks(l.links as typeof links);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">My MODO account</h1>
      <p className="mt-1 text-muted-foreground">Welcome back{patient?.full_name ? `, ${patient.full_name}` : ""}.</p>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Your practitioners</h2>
        {links.length === 0 ? (
          <p className="text-muted-foreground">No practitioners linked yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {links.map((l, i) => l.profiles && (
              <Card key={i}>
                <CardHeader><CardTitle className="text-base">{l.profiles.clinic_name}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">{l.profiles.full_name}</p>
                  <Link to="/m/$slug" params={{ slug: l.profiles.slug }}>
                    <Button size="sm" variant="outline">Visit clinic</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Upcoming appointments</h2>
        <p className="text-sm text-muted-foreground">Bookings will appear here once you make one.</p>
      </section>

      <div className="mt-10">
        <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/m/$slug", params: { slug } }); }}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
