/**
 * Safety net for membership savings pots. The Stripe webhook is meant to add
 * credit on every paid membership invoice, but if an event never arrives the
 * patient's pot stays at £0. Before showing a balance we check Stripe for paid
 * invoices on the membership's subscription and add any that are missing.
 * Idempotent: the invoice id in the note is the dedupe key (same as webhook).
 */
export async function syncMembershipCredits(opts: {
  profileId: string;
  patientUserId?: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("id", opts.profileId)
      .maybeSingle();
    const accountId = (prof as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id;
    if (!accountId) return;

    let q = supabaseAdmin
      .from("patient_memberships")
      .select("id, profile_id, patient_user_id, stripe_subscription_id, membership_plans(credit_cents)")
      .eq("profile_id", opts.profileId)
      .in("status", ["active", "past_due"])
      .not("stripe_subscription_id", "is", null);
    if (opts.patientUserId) q = q.eq("patient_user_id", opts.patientUserId);
    const { data: rows } = await q;
    const memberships = (rows ?? []) as Array<{
      id: string;
      profile_id: string;
      patient_user_id: string | null;
      stripe_subscription_id: string;
      membership_plans?: { credit_cents: number } | null;
    }>;
    if (!memberships.length) return;

    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();

    for (const m of memberships) {
      const creditCents = Number(m.membership_plans?.credit_cents ?? 0);
      if (creditCents <= 0 || !m.patient_user_id) continue;
      try {
        const invoices = await stripe.invoices.list(
          { subscription: m.stripe_subscription_id, status: "paid", limit: 100 },
          { stripeAccount: accountId },
        );
        const paid = invoices.data
          .filter((i) => (i.amount_paid ?? 0) > 0)
          .sort((a, b) => a.created - b.created);
        if (!paid.length) continue;

        const { data: existing } = await supabaseAdmin
          .from("patient_credit_ledger")
          .select("note")
          .eq("ref_type", "membership_invoice")
          .eq("ref_id", m.id);
        const notes = ((existing ?? []) as { note: string | null }[]).map((r) => r.note ?? "");
        // Older manual top-ups were noted "(first payment)" — they cover the first invoice.
        const firstCoveredManually = notes.some((n) => n.includes("(first payment)"));

        for (let idx = 0; idx < paid.length; idx++) {
          const inv = paid[idx];
          if (idx === 0 && firstCoveredManually) continue;
          const note = `Membership top-up ${inv.id}`;
          if (notes.includes(note)) continue;
          await supabaseAdmin.from("patient_credit_ledger").insert({
            patient_user_id: m.patient_user_id,
            clinic_profile_id: m.profile_id,
            delta_pennies: creditCents,
            reason: "membership_credit",
            ref_type: "membership_invoice",
            ref_id: m.id,
            note,
          } as never);
          notes.push(note);
        }
      } catch (e) {
        console.error("[membership credit sync] invoice check failed", m.id, e);
      }
    }
  } catch (e) {
    console.error("[membership credit sync] failed", e);
  }
}
