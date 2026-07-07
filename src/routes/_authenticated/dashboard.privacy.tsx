import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { exportMyAccountData, requestAccountDeletion } from "@/lib/apns.functions";
import { Download, Trash2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/privacy")({
  ssr: false,
  component: PrivacyPage,
});

function PrivacyPage() {
  const exportFn = useServerFn(exportMyAccountData);
  const deleteFn = useServerFn(requestAccountDeletion);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const { json } = await exportFn();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `modo-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export ready");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  async function requestDelete() {
    setBusy(true);
    try {
      await deleteFn({ data: { confirm: true } });
      toast.success("Deletion requested. Your account will be removed within 30 days.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Privacy & data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your rights under UK GDPR. Patient records are managed under your clinic's data-controller
          responsibilities and exported separately.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> What we hold about you</CardTitle>
          <CardDescription>
            Your profile details, sign-in history, terms acceptances, and — on the iOS app — device push
            tokens used only to deliver notifications.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-4 w-4" /> Export my data</CardTitle>
          <CardDescription>Download a JSON copy of everything associated with your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={download} disabled={busy}>Download JSON</Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" /> Delete my account</CardTitle>
          <CardDescription>
            Requests permanent deletion of your account. There is a 30-day grace period during which sign-in
            cancels the request. Patient records owned by your clinic are handled under separate retention rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={busy}>Request deletion</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your Modo account?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your account will be scheduled for deletion. Sign in within 30 days to cancel the request.
                  This does not delete patient records owned by your clinic.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={requestDelete}>Yes, request deletion</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
