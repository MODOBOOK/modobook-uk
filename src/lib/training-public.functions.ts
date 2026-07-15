import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getPub() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const listPublicCourses = createServerFn({ method: "GET" })
  .inputValidator((i: { slug: string; locationId?: string | null }) => i)
  .handler(async ({ data }) => {
    const supabase = getPub();
    const { data: profile, error: pErr } = await supabase
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    if (pErr) throw pErr;

    const { data: courses, error } = await supabase
      .from("training_courses")
      .select("id, name, description, cover_image_url, mode, duration_min, price, deposit_amount, payment_mode, capacity, prerequisites, require_prereq_confirm, cpd_hours, kit_list, sort_order, visibility")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .in("visibility", ["live", "coming_soon"])
      .order("sort_order", { ascending: true });
    if (error) throw error;

    let list = courses ?? [];
    // Filter by selected location if provided
    if (data.locationId && list.length) {
      const ids = list.map((c) => c.id);
      const { data: links } = await supabase
        .from("training_course_locations")
        .select("course_id, location_id")
        .in("course_id", ids);
      const byCourse = new Map<string, string[]>();
      for (const l of links ?? []) {
        const arr = byCourse.get(l.course_id) ?? [];
        arr.push(l.location_id); byCourse.set(l.course_id, arr);
      }
      list = list.filter((c) => {
        const locs = byCourse.get(c.id);
        // No locations set = available everywhere
        return !locs || locs.length === 0 || locs.includes(data.locationId!);
      });
    }

    return { profileId: profile.id as string, courses: list };
  });

export const getPublicCourse = createServerFn({ method: "GET" })
  .inputValidator((i: { slug: string; courseId: string; previewToken?: string | null }) => i)
  .handler(async ({ data }) => {
    const supabase = getPub();
    const { data: profile, error: pErr } = await supabase
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    if (pErr) throw pErr;

    const { data: course, error } = await supabase
      .from("training_courses")
      .select("*")
      .eq("id", data.courseId)
      .eq("profile_id", profile.id)
      .eq("active", true)
      .maybeSingle();
    if (error) throw error;
    if (!course) throw new Error("Course not found");

    // Visibility gate
    if (course.visibility === "hidden") throw new Error("Course not available");
    if (course.visibility === "preview_link" && course.preview_token !== data.previewToken) {
      throw new Error("Course not available");
    }
    const bookable = course.visibility === "live" || (course.visibility === "preview_link" && course.preview_token === data.previewToken);

    const { data: sessions } = await supabase
      .from("training_course_sessions")
      .select("id, session_date, start_time, end_time, location_id")
      .eq("course_id", course.id)
      .gte("session_date", new Date().toISOString().slice(0, 10))
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    // Count bookings per session for capacity display
    const sessionIds = (sessions ?? []).map((s) => s.id);
    let bookingsBySession: Record<string, number> = {};
    if (sessionIds.length) {
      const { data: bks } = await supabase
        .from("training_bookings")
        .select("session_id")
        .in("session_id", sessionIds)
        .in("status", ["pending", "confirmed"]);
      for (const b of bks ?? []) {
        if (b.session_id) bookingsBySession[b.session_id] = (bookingsBySession[b.session_id] ?? 0) + 1;
      }
    }

    // Only the locations this course allows (empty = all)
    const { data: courseLocLinks } = await supabase
      .from("training_course_locations")
      .select("location_id").eq("course_id", course.id);
    const allowedLocIds = (courseLocLinks ?? []).map((r) => r.location_id);

    let locQuery = supabase
      .from("locations")
      .select("id, name, address_line1, address_line2, city, postcode, country")
      .eq("profile_id", profile.id)
      .eq("active", true);
    if (allowedLocIds.length) locQuery = locQuery.in("id", allowedLocIds);
    const { data: locations } = await locQuery;

    return {
      profileId: profile.id as string,
      course,
      bookable,
      sessions: sessions ?? [],
      bookingsBySession,
      locations: locations ?? [],
    };
  });

export const createTrainingBooking = createServerFn({ method: "POST" })
  .inputValidator((i: {
    course_id: string;
    session_id?: string | null;
    trainee_name: string;
    trainee_email: string;
    trainee_phone?: string;
    prereq_confirmed?: boolean;
    // For 1:1 request:
    preferred_date?: string;
    preferred_start?: string;
    location_id?: string | null;
    notes?: string;
  }) => i)
  .handler(async ({ data }) => {
    const supabase = getPub();

    // Load course to enforce capacity + profile
    const { data: course, error: cErr } = await supabase
      .from("training_courses")
      .select("id, profile_id, mode, capacity, active, require_prereq_confirm")
      .eq("id", data.course_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!course || !course.active) throw new Error("Course is not available");

    if (course.require_prereq_confirm && !data.prereq_confirmed) {
      throw new Error("Please confirm you meet the prerequisites");
    }

    // Capacity check for group / multi-day
    if ((course.mode === "group" || course.mode === "multi_day") && data.session_id) {
      const { count } = await supabase
        .from("training_bookings")
        .select("*", { count: "exact", head: true })
        .eq("session_id", data.session_id)
        .in("status", ["pending", "confirmed"]);
      if (course.capacity && (count ?? 0) >= course.capacity) {
        throw new Error("Sorry, this session is now full");
      }
    }

    const insertPayload = {
      course_id: course.id,
      profile_id: course.profile_id,
      session_id: data.session_id ?? null,
      trainee_name: data.trainee_name.trim(),
      trainee_email: data.trainee_email.trim().toLowerCase(),
      trainee_phone: data.trainee_phone?.trim() || null,
      prereq_confirmed: !!data.prereq_confirmed,
      status: "pending" as const,
      payment_status: "pending",
      appointment_date: data.preferred_date || null,
      appointment_start: data.preferred_start || null,
      location_id: data.location_id ?? null,
      notes: data.notes?.trim() || null,
    };

    const { data: row, error } = await supabase
      .from("training_bookings")
      .insert(insertPayload as never)
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });
