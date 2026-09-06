import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { getMyProfile, updateProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { SaveReminder } from "@/components/SaveReminder";

export const Route = createFileRoute("/_authenticated/dashboard/policies")({
  ssr: false,
  loader: async () => {
    const profile = await getMyProfile();
    if (!profile) throw new Error("No profile");
    return { profile };
  },
  component: PoliciesPage,
});

type Rule = { hours_before: number; fee_percent: number };

function PoliciesPage() {
  const { profile } = Route.useLoaderData();
  const savedAboutPage = ((profile as { about_page?: Record<string, unknown> | null }).about_page ?? {}) as Record<string, unknown>;
  const [introHeading, setIntroHeading] = useState<string>(typeof savedAboutPage.intro_heading === "string" ? savedAboutPage.intro_heading : "");
  const [introExpandable, setIntroExpandable] = useState<boolean>(Boolean(savedAboutPage.intro_expandable));
  const [welcome, setWelcome] = useState<string>((profile.welcome_intro_html as string | null) ?? "");
  const [depositText, setDepositText] = useState<string>((profile.deposit_policy_text as string | null) ?? "");
  const [rules, setRules] = useState<Rule[]>(
    (Array.isArray(profile.cancellation_rules) ? (profile.cancellation_rules as Rule[]) : []) ?? [],
  );
  const [termsHtml, setTermsHtml] = useState<string>(((profile as { terms_html?: string | null }).terms_html as string | null) ?? "");
  const [termsRequired, setTermsRequired] = useState<boolean>(Boolean((profile as { terms_required?: boolean | null }).terms_required));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateProfile({
        data: {
          id: profile.id,
          welcome_intro_html: welcome,
          about_page: {
            ...savedAboutPage,
            intro_heading: introHeading,
            intro_expandable: introExpandable,
            show_intro: true,
          },
          deposit_policy_text: depositText,
          cancellation_rules: rules
            .filter((r) => Number.isFinite(r.hours_before) && Number.isFinite(r.fee_percent))
            .sort((a, b) => a.hours_before - b.hours_before),
          terms_html: termsHtml,
          terms_required: termsRequired,
        },
      });
      toast.success("Policies saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome / intro & policies</h1>
        <p className="text-sm text-muted-foreground">
          Shown to patients at the top of your booking link.
        </p>
      </div>
      <SaveReminder />

      <Card>
        <CardHeader><CardTitle>Welcome / intro block</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Heading</Label>
            <Input
              value={introHeading}
              onChange={(e) => setIntroHeading(e.target.value)}
              placeholder="Welcome to the clinic"
            />
          </div>
          <div>
            <Label>Intro text</Label>
          <RichTextEditor value={welcome} onChange={setWelcome} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Use bold, italic, headings, lists or links to introduce your clinic. Paragraph breaks and blank lines are preserved on your booking page.</p>
          <div className="mt-3 flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Make intro expandable</p>
              <p className="text-xs text-muted-foreground">Collapses long text with a "Read more" toggle on the booking page.</p>
            </div>
            <Switch checked={introExpandable} onCheckedChange={setIntroExpandable} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Deposit policy text</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Turning deposits on/off and setting the amount now lives in{" "}
            <Link to="/dashboard/settings" className="font-medium text-primary underline underline-offset-2">
              Booking settings → Payments &amp; deposits
            </Link>
            .
          </p>
          <div>
            <Label>Deposit policy text (optional)</Label>
            <Textarea
              value={depositText}
              onChange={(e) => setDepositText(e.target.value)}
              placeholder="e.g. 20% deposit taken at time of booking, deductible from final price."
              rows={3}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Wording shown to patients about your deposit. The amount is set in Booking settings.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cancellation rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Add charge tiers based on how close to the appointment the patient cancels.
          </p>
          {rules.length === 0 && (
            <p className="text-sm italic text-muted-foreground">No rules yet.</p>
          )}
          {rules.map((r, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">Within (hours)</Label>
                <Input
                  type="number"
                  min="1"
                  value={r.hours_before}
                  onChange={(e) =>
                    setRules((rs) => rs.map((x, j) => (j === i ? { ...x, hours_before: Number(e.target.value) } : x)))
                  }
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">Charge (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={r.fee_percent}
                  onChange={(e) =>
                    setRules((rs) => rs.map((x, j) => (j === i ? { ...x, fee_percent: Number(e.target.value) } : x)))
                  }
                />
              </div>
              <Button variant="ghost" size="icon" onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRules((rs) => [...rs, { hours_before: 24, fee_percent: 50 }])}>
            <Plus className="mr-1 h-4 w-4" />
            Add rule
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Terms & Conditions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Add your own terms and conditions. When required, patients must tick a box agreeing to them before they can complete a booking.
          </p>
          <RichTextEditor value={termsHtml} onChange={setTermsHtml} />
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Require patients to agree</p>
              <p className="text-xs text-muted-foreground">Shows a mandatory tick-box at checkout.</p>
            </div>
            <Switch checked={termsRequired} onCheckedChange={setTermsRequired} />
          </div>
        </CardContent>
      </Card>


      <Button onClick={save} disabled={saving} size="lg">
        {saving ? "Saving…" : "Save policies"}
      </Button>
    </div>
  );
}
