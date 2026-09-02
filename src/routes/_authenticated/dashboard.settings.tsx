import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getMyProfile, updateProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { SaveReminder } from "@/components/SaveReminder";
import { PLATFORM_FEE_LABEL, PLATFORM_FEE_DESCRIPTION, PLATFORM_FEE_PERCENT, PLATFORM_FEE_FIXED_CENTS } from "@/lib/platform-fee";



export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  ssr: false,
  loader: async () => {
    const profile = await getMyProfile();
    if (!profile) throw new Error("No profile");
    return { profile };
  },
  component: SettingsPage,
});

type Profile = Record<string, unknown> & { id: string };

function SettingsPage() {
  const { profile } = Route.useLoaderData() as { profile: Profile };
  const [s, setS] = useState({
    // booking window
    booking_min_notice_hours: (profile.booking_min_notice_hours as number) ?? 0,
    booking_max_lead_days: (profile.booking_max_lead_days as number) ?? 90,
    booking_buffer_before_minutes: (profile.booking_buffer_before_minutes as number) ?? 0,
    booking_buffer_after_minutes: (profile.booking_buffer_after_minutes as number) ?? 0,
    booking_daily_cap: (profile.booking_daily_cap as number | null) ?? null,
    booking_smart_times_enabled: !!profile.booking_smart_times_enabled,
    // payments
    payment_card_full_enabled: profile.payment_card_full_enabled !== false,
    payment_deposit_enabled: !!profile.payment_deposit_enabled,
    payment_klarna_enabled: !!profile.payment_klarna_enabled,
    payment_clearpay_enabled: !!profile.payment_clearpay_enabled,
    payment_pass_fees_to_customer: !!profile.payment_pass_fees_to_customer,
    payment_surcharge_card_enabled: !!profile.payment_surcharge_card_enabled,
    payment_surcharge_card_percent: Number(profile.payment_surcharge_card_percent ?? 0),
    payment_surcharge_bnpl_enabled: !!profile.payment_surcharge_bnpl_enabled,
    payment_surcharge_bnpl_percent: Number(profile.payment_surcharge_bnpl_percent ?? 0),
    payment_surcharge_deposit_enabled: !!profile.payment_surcharge_deposit_enabled,
    payment_surcharge_deposit_percent: Number(profile.payment_surcharge_deposit_percent ?? 0),
    stripe_fee_pass_to_patient: !!profile.stripe_fee_pass_to_patient,
    stripe_fee_bnpl_pass_to_patient: !!(profile as { stripe_fee_bnpl_pass_to_patient?: boolean }).stripe_fee_bnpl_pass_to_patient,
    stripe_fee_card_percent: Number(profile.stripe_fee_card_percent ?? 1.5),
    stripe_fee_card_fixed_cents: Number(profile.stripe_fee_card_fixed_cents ?? 20),
    stripe_fee_bnpl_percent: Number(profile.stripe_fee_bnpl_percent ?? 5.4),
    stripe_fee_bnpl_fixed_cents: Number(profile.stripe_fee_bnpl_fixed_cents ?? 20),
    require_deposit_to_confirm: !!profile.require_deposit_to_confirm,
    allow_pay_in_clinic: profile.allow_pay_in_clinic !== false,
    cash_only_balance: !!(profile as { cash_only_balance?: boolean }).cash_only_balance,
    save_card_on_file: !!(profile as { save_card_on_file?: boolean }).save_card_on_file,
    payment_card_capture_enabled: !!(profile as { payment_card_capture_enabled?: boolean }).payment_card_capture_enabled,
    card_capture_policy_text: ((profile as { card_capture_policy_text?: string | null }).card_capture_policy_text ?? "") as string,
    show_prices_on_booking: profile.show_prices_on_booking !== false,
    enforce_cancellation_fee: !!profile.enforce_cancellation_fee,
    // patient rules
    require_account_to_book: !!profile.require_account_to_book,
    require_phone: profile.require_phone !== false,
    require_dob: profile.require_dob !== false,
    require_address: profile.require_address !== false,
    require_medical_forms_before_appt: !!profile.require_medical_forms_before_appt,
    allow_patient_reschedule: profile.allow_patient_reschedule !== false,
    allow_patient_cancel: profile.allow_patient_cancel !== false,
    patient_reschedule_max: (profile.patient_reschedule_max as number | null) ?? (2 as number | null),
    patient_reschedule_cutoff_hours: (profile.patient_reschedule_cutoff_hours as number | null) ?? (24 as number | null),
    patient_cancel_cutoff_hours: (profile.patient_cancel_cutoff_hours as number | null) ?? (24 as number | null),
    late_cancel_mode: ((profile as { late_cancel_mode?: string }).late_cancel_mode as "block" | "warn_agree" | undefined) ?? "block",
    auto_refund_on_cancel: !!(profile as { auto_refund_on_cancel?: boolean }).auto_refund_on_cancel,
    no_refund_policy_enabled: !!(profile as { no_refund_policy_enabled?: boolean }).no_refund_policy_enabled,
    no_refund_policy_text: ((profile as { no_refund_policy_text?: string | null }).no_refund_policy_text ?? "") as string,
    // invoice branding
    invoice_show_logo: profile.invoice_show_logo !== false,
    invoice_show_bank_details: !!profile.invoice_show_bank_details,
    invoice_bank_name: (profile.invoice_bank_name as string | null) ?? "",
    invoice_account_name: (profile.invoice_account_name as string | null) ?? "",
    invoice_sort_code: (profile.invoice_sort_code as string | null) ?? "",
    invoice_account_number: (profile.invoice_account_number as string | null) ?? "",
    invoice_iban: (profile.invoice_iban as string | null) ?? "",
    invoice_swift: (profile.invoice_swift as string | null) ?? "",
    invoice_payment_reference: (profile.invoice_payment_reference as string | null) ?? "",
    invoice_vat_number: (profile.invoice_vat_number as string | null) ?? "",
    invoice_company_number: (profile.invoice_company_number as string | null) ?? "",
    invoice_footer_notes: (profile.invoice_footer_notes as string | null) ?? "",
  });
const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof s>(key: K, val: (typeof s)[K]) {
    setS((p) => ({ ...p, [key]: val }));
  }

  async function save() {
    setSaving(true);
    try {
      await updateProfile({
        data: {
          id: profile.id,
          ...s,
          // Deposit is always required when deposits are enabled — no separate toggle.
          require_deposit_to_confirm: s.payment_deposit_enabled,
        },
      });
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <div>
        <h1 className="font-serif text-3xl">Booking settings</h1>
        <p className="text-sm text-muted-foreground">
          Toggle features on or off. Every option applies to your public booking link.
        </p>
      </div>
      <SaveReminder />


      {/* BOOKING WINDOW */}

      <Card>
        <CardHeader>
          <CardTitle>Booking window</CardTitle>
          <CardDescription>Control when patients can book.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Minimum notice (hours)"
              hint="Block bookings within this window."
              value={s.booking_min_notice_hours}
              onChange={(v) => set("booking_min_notice_hours", Number(v) || 0)}
            />
            <NumberField
              label="Max lead time (days)"
              hint="How far ahead patients can book."
              value={s.booking_max_lead_days}
              onChange={(v) => set("booking_max_lead_days", Number(v) || 0)}
            />
            <NumberField
              label="Buffer before (mins)"
              hint="Padding before each appointment."
              value={s.booking_buffer_before_minutes}
              onChange={(v) => set("booking_buffer_before_minutes", Number(v) || 0)}
            />
            <NumberField
              label="Buffer after (mins)"
              hint="Padding after each appointment."
              value={s.booking_buffer_after_minutes}
              onChange={(v) => set("booking_buffer_after_minutes", Number(v) || 0)}
            />
            <NumberField
              label="Daily booking cap"
              hint="Leave empty for no cap."
              value={s.booking_daily_cap ?? ""}
              allowEmpty
              onChange={(v) => set("booking_daily_cap", v === "" ? null : Number(v))}
            />
          </div>
          <ToggleRow
            label="Smart appointment times"
            hint="Automatically pack slots to reduce gaps."
            checked={s.booking_smart_times_enabled}
            onChange={(v) => set("booking_smart_times_enabled", v)}
          />
        </CardContent>
      </Card>

      {/* PAYMENTS */}
      <Card>
        <CardHeader>
          <CardTitle>Payments & deposits</CardTitle>
          <CardDescription>Which methods patients can use to pay.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <ToggleRow
            label="Full card payment"
            hint="Standard Stripe card checkout."
            checked={s.payment_card_full_enabled}
            onChange={(v) => set("payment_card_full_enabled", v)}
          />
          <ToggleRow
            label="Deposits"
            hint="Take a deposit at booking, pay rest at the clinic."
            checked={s.payment_deposit_enabled}
            onChange={(v) => set("payment_deposit_enabled", v)}
          />
          <ToggleRow
            label="Klarna"
            hint="Pay in 3 / pay later via Klarna. Same platform fee as every other method."
            checked={s.payment_klarna_enabled}
            onChange={(v) => set("payment_klarna_enabled", v)}
          />
          <ToggleRow
            label="Clearpay"
            hint="Buy-now-pay-later via Clearpay. Same platform fee as every other method."
            checked={s.payment_clearpay_enabled}
            onChange={(v) => set("payment_clearpay_enabled", v)}
          />
          <div className="rounded-md border p-3 space-y-3">
            <div>
              <div className="text-sm font-medium">{PLATFORM_FEE_LABEL} — who pays?</div>
              <p className="text-xs text-muted-foreground">
                A fixed {PLATFORM_FEE_DESCRIPTION} on every online payment — card, Klarna and Clearpay
                are all charged exactly the same. Cash / pay-in-clinic bookings and card-on-file
                captures never carry a fee.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => set("payment_pass_fees_to_customer", false)}
                className={`rounded-md border p-3 text-left text-sm transition ${
                  s.payment_pass_fees_to_customer ? "opacity-70" : "border-primary bg-primary/5"
                }`}
              >
                <div className="font-medium">I pay the fee</div>
                <div className="text-xs text-muted-foreground">
                  Client pays the advertised price. The fee comes out of your payout.
                </div>
              </button>
              <button
                type="button"
                onClick={() => set("payment_pass_fees_to_customer", true)}
                className={`rounded-md border p-3 text-left text-sm transition ${
                  s.payment_pass_fees_to_customer ? "border-primary bg-primary/5" : "opacity-70"
                }`}
              >
                <div className="font-medium">My client pays the fee</div>
                <div className="text-xs text-muted-foreground">
                  Shown as a separate "{PLATFORM_FEE_LABEL}" line at checkout, on top of the price.
                </div>
              </button>
            </div>
            {s.payment_pass_fees_to_customer && (
              <p className="text-xs text-muted-foreground">
                Example: a £100 payment adds {`£${((100 * 100 * PLATFORM_FEE_PERCENT) / 100 / 100 + PLATFORM_FEE_FIXED_CENTS / 100).toFixed(2)}`} — the client pays{" "}
                {`£${(100 + (100 * PLATFORM_FEE_PERCENT) / 100 + PLATFORM_FEE_FIXED_CENTS / 100).toFixed(2)}`}.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              UK rules (Payment Services Regulations 2017) don't allow charging clients more for
              paying by card or with Klarna / Clearpay, so this fee is always the same rate on
              every method.
            </p>
          </div>

          {/* Deposit is now always required when Deposits is enabled — no toggle. */}
          <ToggleRow
            label="Allow pay in clinic"
            hint="Show 'Pay at appointment' option at checkout."
            checked={s.allow_pay_in_clinic}
            onChange={(v) => set("allow_pay_in_clinic", v)}
          />
          <ToggleRow
            label="Cash only for remaining balance"
            hint="Patients pay the deposit online, then bring the rest in cash. Hides the 'Pay in full online' option."
            checked={s.cash_only_balance}
            onChange={(v) => set("cash_only_balance", v)}
          />
          <ToggleRow
            label="Save card on file for no-shows / late cancels"
            hint="Card details are stored securely via Stripe against the patient's profile (card-only, no Apple/Google Pay). Make sure your booking terms tell the patient this will happen — that acceptance is their GDPR consent to store the card."
            checked={s.save_card_on_file}
            onChange={(v) => set("save_card_on_file", v)}
          />
          <ToggleRow
            label="Card capture instead of a deposit"
            hint="Patients can secure a booking by saving their card (nothing charged today) and ticking your cancellation policy. You can charge the no-show fee later."
            checked={s.payment_card_capture_enabled}
            onChange={(v) => set("payment_card_capture_enabled", v)}
          />
          {s.payment_card_capture_enabled && (
            <div className="rounded-xl border p-3 space-y-2">
              <Label>Cancellation policy the patient must tick</Label>
              <Textarea
                rows={3}
                placeholder="I authorise the clinic to securely store my card details and to charge the cancellation or no-show fee set out in their booking policy if I cancel late or do not attend."
                value={s.card_capture_policy_text}
                onChange={(e) => set("card_capture_policy_text", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use the standard wording. Their acceptance is stamped on the appointment.
              </p>
            </div>
          )}
          <ToggleRow
            label="Show prices on booking page"
            hint="Turn off to hide prices (good for consult-led clinics)."
            checked={s.show_prices_on_booking}
            onChange={(v) => set("show_prices_on_booking", v)}
          />
          <ToggleRow
            label="Auto-charge cancellation fee"
            hint="Charge stored card based on your cancellation policy."
            checked={s.enforce_cancellation_fee}
            onChange={(v) => set("enforce_cancellation_fee", v)}
          />
        </CardContent>
      </Card>

      {/* PATIENT RULES */}
      <Card>
        <CardHeader>
          <CardTitle>Patient rules</CardTitle>
          <CardDescription>What patients must provide and what they can change.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <ToggleRow
            label="Require account / login to book"
            checked={s.require_account_to_book}
            onChange={(v) => set("require_account_to_book", v)}
          />
          <ToggleRow
            label="Require phone number"
            checked={s.require_phone}
            onChange={(v) => set("require_phone", v)}
          />
          <ToggleRow
            label="Require date of birth"
            checked={s.require_dob}
            onChange={(v) => set("require_dob", v)}
          />
          <ToggleRow
            label="Require full address"
            checked={s.require_address}
            onChange={(v) => set("require_address", v)}
          />
          <ToggleRow
            label="Require medical forms completed before appointment"
            hint="Patient must submit forms before the appointment can go ahead."
            checked={s.require_medical_forms_before_appt}
            onChange={(v) => set("require_medical_forms_before_appt", v)}
          />
          <ToggleRow
            label="Allow patient self-reschedule"
            checked={s.allow_patient_reschedule}
            onChange={(v) => set("allow_patient_reschedule", v)}
          />
          {s.allow_patient_reschedule && (
            <div className="ml-2 grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
              <NumberField
                label="Max reschedules per booking"
                hint="How many times a patient can move one appointment."
                value={s.patient_reschedule_max ?? ""}
                allowEmpty
                onChange={(v) => set("patient_reschedule_max", v === "" ? null : Number(v))}
              />
              <NumberField
                label="Reschedule cutoff (hours before)"
                hint="Block self-reschedule inside this window."
                value={s.patient_reschedule_cutoff_hours ?? ""}
                allowEmpty
                onChange={(v) => set("patient_reschedule_cutoff_hours", v === "" ? null : Number(v))}
              />
            </div>
          )}
          <ToggleRow
            label="Allow patient self-cancel"
            checked={s.allow_patient_cancel}
            onChange={(v) => set("allow_patient_cancel", v)}
          />
          {s.allow_patient_cancel && (
            <div className="ml-2 space-y-3 rounded-lg border bg-muted/30 p-3">
              <NumberField
                label="Cancel cutoff (hours before)"
                hint="Inside this window, self-cancel is restricted."
                value={s.patient_cancel_cutoff_hours ?? ""}
                allowEmpty
                onChange={(v) => set("patient_cancel_cutoff_hours", v === "" ? null : Number(v))}
              />
              <div>
                <Label className="text-sm font-medium">When cancelling inside the cutoff</Label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Choose how the patient portal handles late cancellations.
                </p>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={s.late_cancel_mode}
                  onChange={(e) => set("late_cancel_mode", e.target.value as "block" | "warn_agree")}
                >
                  <option value="block">Block — ask patient to contact the clinic</option>
                  <option value="warn_agree">Warn & require agreement (they accept any charges per your policy)</option>
                </select>
              </div>
            </div>
          )}
          <ToggleRow
            label="Automatic refunds on in-time cancellations"
            hint="If a patient cancels before your cancel cutoff, anything they paid by card is refunded automatically."
            checked={s.auto_refund_on_cancel}
            onChange={(v) => set("auto_refund_on_cancel", v)}
          />
          <ToggleRow
            label="Show a no-refund policy"
            hint="Displays under your booking & cancellation policy on your booking page."
            checked={s.no_refund_policy_enabled}
            onChange={(v) => set("no_refund_policy_enabled", v)}
          />
          {s.no_refund_policy_enabled && (
            <div className="ml-2 rounded-lg border bg-muted/30 p-3">
              <Label className="text-sm font-medium">No-refund policy wording</Label>
              <Textarea
                className="mt-2"
                rows={3}
                placeholder="All deposits and payments are non-refundable. If you cancel or reschedule, your payment cannot be returned."
                value={s.no_refund_policy_text}
                onChange={(e) => set("no_refund_policy_text", e.target.value)}
              />
            </div>
          )}

        </CardContent>
      </Card>

{/* INVOICE & BANK DETAILS */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice & bank details</CardTitle>
          <CardDescription>Branded on every PDF invoice you download or email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            label="Show clinic logo on invoice"
            hint="Uses your profile picture / logo upload."
            checked={s.invoice_show_logo}
            onChange={(v) => set("invoice_show_logo", v)}
          />
          <ToggleRow
            label="Show bank details on invoice"
            hint="Adds a bank transfer panel under the totals."
            checked={s.invoice_show_bank_details}
            onChange={(v) => set("invoice_show_bank_details", v)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Bank name" value={s.invoice_bank_name} onChange={(v) => set("invoice_bank_name", v)} />
            <TextField label="Account name" value={s.invoice_account_name} onChange={(v) => set("invoice_account_name", v)} />
            <TextField label="Sort code" value={s.invoice_sort_code} onChange={(v) => set("invoice_sort_code", v)} placeholder="00-00-00" />
            <TextField label="Account number" value={s.invoice_account_number} onChange={(v) => set("invoice_account_number", v)} />
            <TextField label="IBAN" value={s.invoice_iban} onChange={(v) => set("invoice_iban", v)} />
            <TextField label="SWIFT / BIC" value={s.invoice_swift} onChange={(v) => set("invoice_swift", v)} />
            <TextField label="Default payment reference" value={s.invoice_payment_reference} onChange={(v) => set("invoice_payment_reference", v)} placeholder="e.g. INV-{patient}" />
            <TextField label="VAT number" value={s.invoice_vat_number} onChange={(v) => set("invoice_vat_number", v)} />
            <TextField label="Company number" value={s.invoice_company_number} onChange={(v) => set("invoice_company_number", v)} />
          </div>
          <div>
            <Label className="text-xs">Footer notes</Label>
            <Input
              value={s.invoice_footer_notes}
              onChange={(e) => set("invoice_footer_notes", e.target.value)}
              placeholder="e.g. Payment due within 7 days. Thank you for your custom."
            />
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-luxe">
          {saving ? "Saving…" : "Save all settings"}
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  allowEmpty,
}: {
  label: string;
  hint?: string;
  value: number | string;
  onChange: (v: number | string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min="0"
        value={value as number | string}
        onChange={(e) => {
          const raw = e.target.value;
          if (allowEmpty && raw === "") return onChange("");
          onChange(Number(raw));
        }}
      />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TextField({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function SurchargeRow({
  label, enabled, percent, onToggle, onPercent,
}: {
  label: string;
  enabled: boolean;
  percent: number;
  onToggle: (v: boolean) => void;
  onPercent: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
      </div>
      <div className="flex items-center gap-2">
        {enabled && (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={percent}
              onFocus={(e) => { if (Number(e.target.value) === 0) e.target.select(); }}
              onChange={(e) => onPercent(Number(e.target.value) || 0)}
              className="w-20 h-8"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        )}
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
    </div>
  );
}
