import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  REGULATORY_BODIES,
  getHubContext,
  submitPrescriberVerification,
} from "@/lib/hub.functions";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hub/verification")({
  ssr: false,
  component: Verification,
});

function Verification() {
  const getCtx = useServerFn(getHubContext);
  const submit = useServerFn(submitPrescriberVerification);
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof getHubContext>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    regulatory_body: "GMC",
    regulatory_body_other: "",
    registration_number: "",
    id_document_path: "",
    id_document_name: "",
  });

  useEffect(() => {
    getCtx()
      .then((c) => {
        setCtx(c);
        if (c.prescriber) {
          setForm((f) => ({
            ...f,
            full_name: c.prescriber!.full_name ?? "",
            regulatory_body: c.prescriber!.regulatory_body ?? "GMC",
            regulatory_body_other: c.prescriber!.regulatory_body_other ?? "",
            registration_number: c.prescriber!.registration_number ?? "",
            id_document_path: c.prescriber!.id_document_path ?? "",
            id_document_name: c.prescriber!.id_document_path?.split("/").pop() ?? "",
          }));
        }
      })
      .catch((e) => toast.error(e.message));
  }, [getCtx]);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${u.user.id}/id-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("prescriber-ids")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      setForm((f) => ({ ...f, id_document_path: path, id_document_name: file.name }));
      toast.success("ID uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.id_document_path) {
      toast.error("Please upload a form of ID");
      return;
    }
    setLoading(true);
    try {
      await submit({
        data: {
          full_name: form.full_name,
          regulatory_body: form.regulatory_body,
          regulatory_body_other: form.regulatory_body_other || null,
          registration_number: form.registration_number,
          id_document_path: form.id_document_path,
        },
      });
      toast.success("Submitted — admin will review shortly.");
      const c = await getCtx();
      setCtx(c);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const status = ctx?.prescriber?.status;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Prescriber verification</CardTitle>
          <CardDescription>
            We verify every prescriber against their regulatory body. This protects patients and
            keeps the Hub trustworthy for collaborating practitioners.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status && (
            <div className="mb-4 rounded-md border bg-muted/30 p-3 text-sm">
              <strong>Status:</strong> {status}
              {ctx?.prescriber?.admin_note && (
                <div className="mt-1 text-muted-foreground">Note: {ctx.prescriber.admin_note}</div>
              )}
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name (as registered)</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
                minLength={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Regulatory body</Label>
                <Select
                  value={form.regulatory_body}
                  onValueChange={(v) => setForm({ ...form, regulatory_body: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REGULATORY_BODIES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg_no">Professional registration number</Label>
                <Input
                  id="reg_no"
                  value={form.registration_number}
                  onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                  required
                  minLength={2}
                  placeholder="e.g. 7654321"
                />
              </div>
            </div>

            {form.regulatory_body === "OTHER" && (
              <div className="space-y-2">
                <Label htmlFor="reg_other">Which body?</Label>
                <Input
                  id="reg_other"
                  value={form.regulatory_body_other}
                  onChange={(e) => setForm({ ...form, regulatory_body_other: e.target.value })}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="id_file">Photo ID (passport or driving licence)</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="id_file"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                  disabled={uploading}
                />
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                {form.id_document_path && !uploading && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {form.id_document_name}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Stored privately. Only you and admins can view this document.
              </p>
            </div>

            <Button type="submit" disabled={loading || uploading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {status ? "Resubmit for review" : "Submit for review"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
