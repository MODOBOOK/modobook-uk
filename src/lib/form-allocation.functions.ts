import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return await activeProfileId(supabase, userId);
}

/**
 * Aggregate loader for the "Attach forms" allocation matrix.
 * Returns treatments + all medical / consent / aftercare templates
 * available to this practitioner, plus current links for each treatment.
 */
export const listFormAllocation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", await __activeProfileId(supabase, userId))
      .maybeSingle();
    if (!profile) {
      return {
        treatments: [],
        medicalForms: [],
        consents: [],
        aftercares: [],
        links: {} as Record<
          string,
          { medical: string[]; consent: string[]; aftercare: string[] }
        >,
      };
    }
    const profileId = profile.id;
    const ownOrSystem = `is_system.eq.true,profile_id.eq.${profileId}`;

    const [
      { data: treatments },
      { data: mfs },
      { data: cts },
      { data: acs },
      { data: mLinks },
      { data: cLinks },
      { data: aLinks },
    ] = await Promise.all([
      supabase
        .from("treatments")
        .select("id, name")
        .eq("profile_id", profileId)
        .order("name"),
      supabase
        .from("medical_form_templates")
        .select("id, name, is_system")
        .or(ownOrSystem)
        .order("is_system", { ascending: false })
        .order("name"),
      supabase
        .from("consent_templates")
        .select("id, name, is_system")
        .or(ownOrSystem)
        .order("is_system", { ascending: false })
        .order("name"),
      supabase
        .from("aftercare_templates")
        .select("id, name, delay_hours, is_system")
        .or(ownOrSystem)
        .order("is_system", { ascending: false })
        .order("name"),
      supabase.from("treatment_medical_forms").select("treatment_id, template_id"),
      supabase.from("treatment_consents").select("treatment_id, consent_template_id"),
      supabase.from("treatment_aftercare_templates").select("treatment_id, template_id"),
    ]);

    const links: Record<
      string,
      { medical: string[]; consent: string[]; aftercare: string[] }
    > = {};
    const ensure = (tid: string) => {
      if (!links[tid]) links[tid] = { medical: [], consent: [], aftercare: [] };
      return links[tid];
    };
    for (const r of (mLinks ?? []) as { treatment_id: string; template_id: string }[]) {
      ensure(r.treatment_id).medical.push(r.template_id);
    }
    for (const r of (cLinks ?? []) as {
      treatment_id: string;
      consent_template_id: string;
    }[]) {
      ensure(r.treatment_id).consent.push(r.consent_template_id);
    }
    for (const r of (aLinks ?? []) as { treatment_id: string; template_id: string }[]) {
      ensure(r.treatment_id).aftercare.push(r.template_id);
    }

    return {
      treatments: (treatments ?? []) as { id: string; name: string }[],
      medicalForms: (mfs ?? []) as { id: string; name: string; is_system: boolean }[],
      consents: (cts ?? []) as { id: string; name: string; is_system: boolean }[],
      aftercares: (acs ?? []) as { id: string; name: string; delay_hours: number; is_system: boolean }[],
      links,
    };
  });
