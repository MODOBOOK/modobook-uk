import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isNativeAppSync } from "@/lib/native";

const KEY = "modo:native-consent:v1";

/**
 * Shown once, on first launch inside the native app. Records GDPR-relevant
 * acknowledgements locally; the same acceptance is captured server-side
 * through the existing terms-acceptance flow when the user first signs in.
 */
export function FirstRunConsent() {
  const [open, setOpen] = useState(false);
  const [dataOk, setDataOk] = useState(false);
  const [healthOk, setHealthOk] = useState(false);

  useEffect(() => {
    if (!isNativeAppSync()) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY) === "1") return;
    setOpen(true);
  }, []);

  function accept() {
    if (!dataOk || !healthOk) return;
    localStorage.setItem(KEY, "1");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={() => { /* modal — must accept */ }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Welcome to Modo Practitioner</DialogTitle>
          <DialogDescription>
            Before you continue, please review how this app handles data.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-80 rounded-md border p-4 text-sm leading-relaxed">
          <p className="mb-3">
            Modo Practitioner is a clinical management tool for aesthetic practitioners in the UK.
            It processes personal data on behalf of your clinic under UK GDPR and the Data Protection Act 2018.
          </p>
          <p className="mb-3">
            <strong>What we process:</strong> your account details (name, email), your patients' contact and
            appointment records, and — where you record them — health information, photographs and consent signatures.
          </p>
          <p className="mb-3">
            <strong>On this device:</strong> photos taken through the app are uploaded to your clinic's
            encrypted storage and are not kept on the device. Push notification tokens are stored only to deliver
            appointment and referral alerts.
          </p>
          <p className="mb-3">
            <strong>Your rights:</strong> you can export or delete your account at any time from
            Settings → Privacy inside the app. Patient data belongs to your clinic and is managed under
            your clinic's data-controller responsibilities.
          </p>
          <p className="mb-3">
            <strong>No tracking:</strong> the app does not use third-party advertising or analytics SDKs
            and does not track you across other apps or websites.
          </p>
          <p>
            Full details: <a className="underline" href="https://modobook.uk/privacy" target="_blank" rel="noreferrer">modobook.uk/privacy</a>.
          </p>
        </ScrollArea>
        <div className="space-y-3 py-2">
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={dataOk} onCheckedChange={(v) => setDataOk(!!v)} className="mt-0.5" />
            <span>I understand how personal data is processed and stored.</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={healthOk} onCheckedChange={(v) => setHealthOk(!!v)} className="mt-0.5" />
            <span>I acknowledge that health information and patient photographs must only be recorded with the patient's consent.</span>
          </label>
        </div>
        <DialogFooter>
          <Button onClick={accept} disabled={!dataOk || !healthOk}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
