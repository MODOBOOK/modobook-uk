import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type TrainingMode = Database["public"]["Enums"]["training_mode"];
type PaymentMode = Database["public"]["Enums"]["payment_mode"];
type BookingStatus = Database["public"]["Enums"]["training_booking_status"];

export type CourseVisibility = "live" | "hidden" | "preview_link" | "coming_soon";
export type SchedulingMode = "fixed" | "availability";

export type CourseInput = {
  name: string;
  description?: string | null;
  cover_image_url?: string | null;
  mode?: TrainingMode;
  duration_min?: number;
  price?: number;
  deposit_amount?: number | null;
  payment_mode?: PaymentMode;
  allow_split_payment?: boolean;
  capacity?: number | null;
  prerequisites?: string | null;
  require_prereq_confirm?: boolean;
  cpd_hours?: number | null;
  certificate_template_url?: string | null;
  materials_html?: string | null;
  kit_list?: string | null;
  handout_url?: string | null;
  handout_name?: string | null;
  active?: boolean;
  visibility?: CourseVisibility;
  scheduling_mode?: SchedulingMode;
};

async function getProfileId(
  supabase: ReturnType<typeof requireSupabaseAuth extends { context: infer C } ? never : never> | any,
  userId: string,
) {
  const { data, error } = await supabase
    .from("profiles").select("id").eq("user_id", userId).single();
  if (error) throw error;
  return data.id as string;
}

/* ---------------- Courses ---------------- */

export const listMyCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    const { data, error } = await supabase
      .from("training_courses")
      .select("*")
      .eq("profile_id", profileId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const getCourseWithSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: course, error } = await supabase
      .from("training_courses").select("*").eq("id", data.id).single();
    if (error) throw error;
    const { data: sessions, error: sErr } = await supabase
      .from("training_course_sessions")
      .select("*").eq("course_id", data.id)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (sErr) throw sErr;
    const { data: locs } = await supabase
      .from("training_course_locations")
      .select("location_id").eq("course_id", data.id);
    const location_ids = (locs ?? []).map((r: { location_id: string }) => r.location_id);
    const { data: prof } = await supabase
      .from("profiles").select("slug").eq("user_id", userId).single();
    return { course, sessions: sessions ?? [], location_ids, slug: prof?.slug ?? null };
  });

export const setCourseLocations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { course_id: string; location_ids: string[] }) => i)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error: delErr } = await supabase
      .from("training_course_locations").delete().eq("course_id", data.course_id);
    if (delErr) throw delErr;
    if (data.location_ids.length) {
      const rows = data.location_ids.map((id) => ({ course_id: data.course_id, location_id: id }));
      const { error } = await supabase.from("training_course_locations").insert(rows as never);
      if (error) throw error;
    }
    return { ok: true };
  });

export const createCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: CourseInput) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    const { data: row, error } = await supabase
      .from("training_courses")
      .insert({
        profile_id: profileId,
        name: data.name,
        description: data.description ?? null,
        cover_image_url: data.cover_image_url ?? null,
        mode: data.mode ?? "one_to_one",
        duration_min: data.duration_min ?? 120,
        price: data.price ?? 0,
        deposit_amount: data.deposit_amount ?? null,
        payment_mode: data.payment_mode ?? "full",
        allow_split_payment: data.allow_split_payment ?? false,
        capacity: data.capacity ?? null,
        prerequisites: data.prerequisites ?? null,
        require_prereq_confirm: data.require_prereq_confirm ?? false,
        cpd_hours: data.cpd_hours ?? null,
        certificate_template_url: data.certificate_template_url ?? null,
        materials_html: data.materials_html ?? null,
        kit_list: data.kit_list ?? null,
        active: data.active ?? true,
        scheduling_mode: data.scheduling_mode ?? "fixed",
      } as never)
      .select().single();
    if (error) throw error;
    return row;
  });

export const updateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string } & Partial<CourseInput>) => i)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: Record<string, unknown> = {};
    for (const k of Object.keys(data)) {
      if (k === "id") continue;
      patch[k] = (data as Record<string, unknown>)[k];
    }
    const { data: row, error } = await supabase
      .from("training_courses").update(patch as never).eq("id", data.id)
      .select().single();
    if (error) throw error;
    return row;
  });

export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("training_courses").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------------- Sessions ---------------- */

export const upsertSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    course_id: string;
    sessions: Array<{
      id?: string;
      session_date: string;
      start_time: string;
      end_time: string;
      location_id?: string | null;
      sort_order?: number;
    }>;
    deleted_ids?: string[];
  }) => i)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.deleted_ids?.length) {
      const { error } = await supabase
        .from("training_course_sessions").delete().in("id", data.deleted_ids);
      if (error) throw error;
    }
    for (let idx = 0; idx < data.sessions.length; idx++) {
      const s = data.sessions[idx];
      const payload = {
        course_id: data.course_id,
        session_date: s.session_date,
        start_time: s.start_time,
        end_time: s.end_time,
        location_id: s.location_id ?? null,
        sort_order: s.sort_order ?? idx,
      };
      if (s.id) {
        const { error } = await supabase
          .from("training_course_sessions").update(payload as never).eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("training_course_sessions").insert(payload as never);
        if (error) throw error;
      }
    }
    return { ok: true };
  });

/* ---------------- Bookings (practitioner) ---------------- */

export const listMyTrainingBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    const { data, error } = await supabase
      .from("training_bookings")
      .select("*, training_courses(name, mode)")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; status: BookingStatus }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("training_bookings").update({ status: data.status } as never).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
