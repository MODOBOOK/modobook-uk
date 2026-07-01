import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ConsentSectionsView, type ConsentSection } from "@/components/ConsentSections";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

const getConsent = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: rows, error } = await sb.rpc("get_consent_by_token", { p_token: data.token });
    if (error) throw error;
    const row = rows?.[0];
    if (!row) throw new Error("Consent form not found");
    return row;
  });

const submitConsent = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { token: string; signatureName: string; signatureData: string }) => input,
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: ok, error } = await sb.rpc("submit_consent", {
      p_token: data.token,
      p_signature_name: data.signatureName,
      p_signature_data: data.signatureData,
    });
    if (error) throw error;
    return { ok };
  });

export const Route = createFileRoute("/c/$token")({
  loader: ({ params }) => getConsent({ data: { token: params.token } }),
  component: ConsentPage,
});

function ConsentPage() {
  const consent = Route.useLoaderData();
  const submit = useServerFn(submitConsent);
  const { token } = Route.useParams();
  const [name, setName] = useState(consent.patient_name ?? "");
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(consent.status === "signed");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name || !agreed) {
      toast.error("Please type your full name and tick to agree.");
      return;
    }
    setSubmitting(true);
    try {
      await submit({ data: { token, signatureName: name, signatureData: `typed:${name}` } });
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const backHref = consent.slug ? `/m/${consent.slug}` : "/";
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
        <h1 className="text-2xl font-bold">Consent submitted</h1>
        <p className="mt-2 text-muted-foreground">
          Thank you. Your practitioner has been notified.
        </p>
        <div className="mt-6">
          <a href={backHref}><Button variant="outline">Back to {consent.clinic_name || "clinic"}</Button></a>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>{consent.template_name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {[consent.clinic_name, consent.treatment_name, formatConsentDateTime(consent.scheduled_date, consent.start_time)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <ConsentSectionsView
            sections={(consent.template_sections as ConsentSection[] | null) ?? null}
            summary={consent.template_summary as string | null | undefined}
            fallbackBody={consent.template_body}
          />


          {consent.requires_signature && (
            <>
              <div>
                <Label htmlFor="sig-name">Type your full name as signature</Label>
                <Input id="sig-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  I have read and understood this consent form, and the
                  information I have provided is accurate.
                </span>
              </label>
            </>
          )}

          <Button className="w-full" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Submitting…" : "Submit consent"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function formatConsentDateTime(date?: string | null, time?: string | null) {
  if (!date) return null;
  return `${new Date(date).toLocaleDateString()}${time ? ` at ${String(time).slice(0, 5)}` : ""}`;
}
