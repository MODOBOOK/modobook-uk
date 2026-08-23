import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

async function getProfileId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
  return data?.id ?? null;
}

// Charge the saved card on file for the current practitioner's clinic client.
// Used for no-shows, late-cancel fees, etc. Off-session — the patient is not
// present and gave consent via the practitioner's booking terms when saving
// the card at their previous checkout.
export const chargeCardOnFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; amountCents: number; description: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) throw new Error("No profile");

    if (!data.clientId) throw new Error("Missing client");
    if (!data.amountCents || data.amountCents < 100) {
      throw new Error("Minimum charge is £1.00");
    }
    if (!data.description?.trim()) throw new Error("Please add a reason for the charge.");

    const { data: client, error: cErr } = await supabase
      .from("clinic_clients")
      .select(
        "id, profile_id, full_name, email, stripe_customer_id, stripe_payment_method_id, card_brand, card_last4",
      )
      .eq("id", data.clientId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!client) throw new Error("Client not found");
    const c = client as {
      id: string;
      profile_id: string;
      full_name: string | null;
      email: string | null;
      stripe_customer_id: string | null;
      stripe_payment_method_id: string | null;
    };
    if (c.profile_id !== profileId) throw new Error("Not authorised for this client");
    if (!c.stripe_customer_id || !c.stripe_payment_method_id) {
      throw new Error("This patient has no card on file yet.");
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarding_status")
      .eq("id", profileId)
      .maybeSingle();
    const p = prof as {
      stripe_connect_account_id: string | null;
      stripe_connect_onboarding_status: string | null;
    } | null;
    if (!p?.stripe_connect_account_id) throw new Error("Stripe is not connected.");
    if (p.stripe_connect_onboarding_status && p.stripe_connect_onboarding_status !== "active") {
      throw new Error("Stripe onboarding is not complete yet.");
    }

    const { chargeSavedCardOffSession } = await import("./stripe.server");
    try {
      const pi = await chargeSavedCardOffSession({
        accountId: p.stripe_connect_account_id,
        customerId: c.stripe_customer_id,
        paymentMethodId: c.stripe_payment_method_id,
        amountCents: Math.round(data.amountCents),
        description: data.description.slice(0, 200),
        metadata: {
          clinic_client_id: c.id,
          reason: data.description.slice(0, 200),
          off_session: "1",
        },
      });
      return { id: pi.id, status: pi.status, amount: pi.amount };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Charge failed";
      // Stripe often needs SCA / authentication for off-session charges. Bubble
      // up a friendly message so the practitioner can ask the patient to
      // re-authorise via a fresh checkout link.
      throw new Error(
        msg.toLowerCase().includes("authentication_required")
          ? "The bank asked for the cardholder to authenticate this payment. Send them a fresh payment link instead."
          : msg,
      );
    }
  });

// Remove the card on file (patient withdrew consent / practitioner tidy-up).
// Detaches the PaymentMethod on Stripe and clears the fields on clinic_clients.
export const removeCardOnFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) throw new Error("No profile");

    const { data: client } = await supabase
      .from("clinic_clients")
      .select("id, profile_id, stripe_payment_method_id")
      .eq("id", data.clientId)
      .maybeSingle();
    const c = client as {
      id: string;
      profile_id: string;
      stripe_payment_method_id: string | null;
    } | null;
    if (!c) throw new Error("Client not found");
    if (c.profile_id !== profileId) throw new Error("Not authorised");

    if (c.stripe_payment_method_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("stripe_connect_account_id")
        .eq("id", profileId)
        .maybeSingle();
      const accountId = (prof as { stripe_connect_account_id?: string } | null)?.stripe_connect_account_id;
      if (accountId) {
        try {
          const { getStripe } = await import("./stripe.server");
          await getStripe().paymentMethods.detach(
            c.stripe_payment_method_id,
            {},
            { stripeAccount: accountId },
          );
        } catch (e) {
          // Non-fatal — detach can fail if it's already detached on Stripe.
          console.warn("[removeCardOnFile] detach failed", e);
        }
      }
    }

    const patch = {
      stripe_customer_id: null,
      stripe_payment_method_id: null,
      card_brand: null,
      card_last4: null,
      card_exp_month: null,
      card_exp_year: null,
      card_saved_at: null,
      card_save_consent_at: null,
    };
    const { error } = await supabase
      .from("clinic_clients")
      .update(patch as never)
      .eq("id", data.clientId);
    if (error) throw error;
    return { ok: true };
  });

// Get card-on-file details for an appointment's linked patient (via clinic_clients).
export const getCardOnFileForAppointment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { appointmentId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: appt } = await supabase
      .from("appointments")
      .select("id, practitioner_id, patient_email, patient_phone")
      .eq("id", data.appointmentId)
      .maybeSingle();
    const a = appt as {
      id: string;
      practitioner_id: string;
      patient_email: string | null;
      patient_phone: string | null;
    } | null;
    if (!a) return null;
    if (a.practitioner_id !== userId) throw new Error("Not authorised");

    // Match clinic_client by email or phone for this practitioner.
    let query = supabase
      .from("clinic_clients")
      .select("id, full_name, card_brand, card_last4, card_exp_month, card_exp_year, stripe_customer_id, stripe_payment_method_id")
      .eq("profile_id", userId)
      .limit(1);
    if (a.patient_email) query = query.eq("email", a.patient_email);
    else if (a.patient_phone) query = query.eq("phone", a.patient_phone);
    else return null;

    const { data: rows } = await query;
    const c = (rows?.[0] ?? null) as {
      id: string;
      full_name: string | null;
      card_brand: string | null;
      card_last4: string | null;
      card_exp_month: number | null;
      card_exp_year: number | null;
      stripe_customer_id: string | null;
      stripe_payment_method_id: string | null;
    } | null;
    if (!c) return null;
    return {
      clientId: c.id,
      hasCard: !!(c.stripe_customer_id && c.stripe_payment_method_id),
      brand: c.card_brand,
      last4: c.card_last4,
      expMonth: c.card_exp_month,
      expYear: c.card_exp_year,
    };
  });
