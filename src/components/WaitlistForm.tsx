import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinWaitlist } from "@/lib/waitlist.functions";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const WAITLIST_CONSENT_TEXT =
  "I agree that MODO Book may store my name and email to contact me about the MODO launch, product updates and early-access offers. I can unsubscribe at any time.";

interface WaitlistFormProps {
  /** Render a slim, single-column variant suitable for inline sections. */
  compact?: boolean;
  /** Called after a successful join. */
  onSuccess?: () => void;
}

/** The launch waitlist is closed — the form renders a closed notice instead. */
export const WAITLIST_CLOSED = true;

export function WaitlistForm({ compact, onSuccess }: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [clinic, setClinic] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);

  void compact;


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) {
      toast.error("Please enter your name");
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!consent) {
      toast.error("Please tick the consent box to join the list");
      return;
    }
    setSubmitting(true);
    try {
      const res = await joinWaitlist({
        data: {
          name: trimmedName,
          email: trimmedEmail,
          role: role.trim() || null,
          clinic: clinic.trim() || null,
          consent: true,
        },
      });
      setSubmitting(false);
      if (!res?.ok) {
        toast.error("Couldn't join the list. Please try again.");
        return;
      }
      setJoined(true);
      onSuccess?.();
      if (res.alreadyJoined) {
        toast.success("You're already on the list — we'll be in touch at launch.");
      } else {
        toast.success("You're on the list — check your inbox for a welcome email.");
      }
    } catch {
      setSubmitting(false);
      toast.error("Couldn't join the list. Please try again.");
    }
  }

  if (WAITLIST_CLOSED) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--clinical-blue-soft)] text-[color:var(--clinical-blue)]">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h3 className="text-xl font-semibold text-[color:var(--ink)]">The launch list is closed</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[color:var(--ink-soft)]">
          MODO is now open to the clinics who joined the launch list. If you're already on it,
          you can create your account and get started today.
        </p>
        <a
          href="/auth"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[color:var(--ink)] px-8 text-sm font-medium text-white hover:bg-[color:var(--ink)]/90"
        >
          Create your account
          <ArrowRight className="ml-1 h-4 w-4" />
        </a>
        <p className="mt-4 text-[11px] text-[color:var(--ink-soft)]">
          Not on the list? Email info@modobook.co.uk and we'll let you know when we reopen.
        </p>
      </div>
    );
  }

  if (joined) {

    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--clinical-blue-soft)] text-[color:var(--clinical-blue)]">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h3 className="text-xl font-semibold text-[color:var(--ink)]">You're on the list</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[color:var(--ink-soft)]">
          We'll email you as soon as MODO opens up. Check your inbox for a welcome note.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input
        required
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-11 rounded-full bg-[color:var(--muted)]/60 px-4"
      />
      {!compact && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Role (Nurse, Doctor, Aesthetician…)"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-11 rounded-full bg-[color:var(--muted)]/60 px-4"
          />
          <Input
            placeholder="Clinic name (optional)"
            value={clinic}
            onChange={(e) => setClinic(e.target.value)}
            className="h-11 rounded-full bg-[color:var(--muted)]/60 px-4"
          />
        </div>
      )}
      {compact && (
        <>
          <Input
            placeholder="Role (Nurse, Doctor, Aesthetician…)"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-11 rounded-full bg-[color:var(--muted)]/60 px-4"
          />
          <Input
            placeholder="Clinic name (optional)"
            value={clinic}
            onChange={(e) => setClinic(e.target.value)}
            className="h-11 rounded-full bg-[color:var(--muted)]/60 px-4"
          />
        </>
      )}
      <Input
        type="email"
        required
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-11 rounded-full bg-[color:var(--muted)]/60 px-4"
      />
      <label className="flex items-start gap-3 rounded-2xl border border-[color:var(--hairline)] bg-[color:var(--muted)]/40 p-3 text-xs text-[color:var(--ink-soft)]">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--ink)]"
          required
        />
        <span>{WAITLIST_CONSENT_TEXT}</span>
      </label>
      <Button
        type="submit"
        size="lg"
        disabled={submitting}
        className="w-full rounded-full bg-[color:var(--ink)] px-8 text-sm font-medium text-white hover:bg-[color:var(--ink)]/90"
      >
        {submitting ? "Adding…" : "Join the launch list"}
        <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
      <p className="text-center text-[11px] text-[color:var(--ink-soft)]">
        No spam. Unsubscribe any time. UK/EU data residency.
      </p>
    </form>
  );
}
