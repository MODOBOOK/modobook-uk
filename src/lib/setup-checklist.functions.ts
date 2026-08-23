import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return await activeProfileId(supabase, userId);
}

export type SetupStep = {
  key: string;
  label: string;
  description: string;
  to: string;
  done: boolean;
};

/**
 * Progress checklist shown on the dashboard home. Purely derived from
 * existing data — nothing is stored, so it self-heals as the practitioner
 * fills things in (or removes them).
 */
export const getSetupChecklist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "id, clinic_name, avatar_url, phone, welcome_intro_html, about_page, stripe_connect_account_id, deposit_amount_cents, deposit_percent, deposit_policy_text",
      )
      .eq("id", await __activeProfileId(supabase, userId))
      .maybeSingle();

    if (!profile) return { steps: [] as SetupStep[], done: 0, total: 0 };

    const count = async (table: "locations" | "treatments" | "availability_rules" | "medical_form_templates") => {
      const { count: c } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id);
      return c ?? 0;
    };

    const [locations, treatments, rules, forms, theme] = await Promise.all([
      count("locations"),
      count("treatments"),
      count("availability_rules"),
      count("medical_form_templates"),
      supabase.from("clinic_theme").select("logo_url").eq("profile_id", profile.id).maybeSingle(),
    ]);

    const about = (profile.about_page ?? {}) as Record<string, unknown>;


    const steps: SetupStep[] = [
      {
        key: "clinic",
        label: "Business details",
        description: "Clinic name, contact details and socials",
        to: "/dashboard/clinic",
        done: Boolean(profile.clinic_name && profile.phone),
      },
      {
        key: "branding",
        label: "Add your branding",
        description: "Logo, colours and fonts",
        to: "/dashboard/branding",
        done: Boolean(theme.data?.logo_url || profile.avatar_url),
      },
      {
        key: "locations",
        label: "Add a location",
        description: "Where patients will see you",
        to: "/dashboard/locations",
        done: locations > 0,
      },
      {
        key: "treatments",
        label: "Add your treatments",
        description: "Services, pricing and durations",
        to: "/dashboard/services",
        done: treatments > 0,
      },
      {
        key: "availability",
        label: "Set your availability",
        description: "Opening times patients can book",
        to: "/dashboard/availability",
        done: rules > 0,
      },
      {
        key: "forms",
        label: "Medical & consent forms",
        description: "Sent automatically when patients book",
        to: "/dashboard/form-allocation",
        done: forms > 0,
      },
      {
        key: "about",
        label: "Welcome message",
        description: "Your intro on the booking page",
        to: "/dashboard/policies",
        done: Boolean(profile.welcome_intro_html || about.intro_heading),
      },
      {
        key: "payments",
        label: "Take payments",
        description: "Connect Stripe for deposits and payments",
        to: "/dashboard/payments",
        done: Boolean(profile.stripe_connect_account_id),
      },
      {
        key: "payment_settings",
        label: "Payment settings",
        description: "Choose deposits, pay now or pay in clinic, and your policy",
        to: "/dashboard/policies",
        done: Boolean(
          (profile.deposit_amount_cents ?? 0) > 0 ||
            Number(profile.deposit_percent ?? 0) > 0 ||
            profile.deposit_policy_text,
        ),
      },
    ];



    return {
      steps,
      done: steps.filter((s) => s.done).length,
      total: steps.length,
    };
  });
