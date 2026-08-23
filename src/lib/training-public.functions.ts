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
      .select("id, name, description, cover_image_url, mode, scheduling_mode, duration_min, day_count, days_consecutive, day_duration_min, price, deposit_amount, payment_mode, capacity, prerequisites, require_prereq_confirm, cpd_hours, kit_list, materials_html, handout_url, handout_name, sort_order, visibility, training_category_id")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .in("visibility", ["live", "coming_soon"])
      .order("sort_order", { ascending: true });
    if (error) throw error;

    let list = courses ?? [];
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
        return !locs || locs.length === 0 || locs.includes(data.locationId!);
      });
    }

    // Orderable training categories for grouping on the public page.
    const { data: cats } = await supabase
      .from("treatment_categories")
      .select("id, name, sort_order")
      .eq("profile_id", profile.id)
      .eq("kind", "training")
      .order("sort_order", { ascending: true });

    // Practitioner-authored copy for the public training page (optional).
    const { data: page } = await supabase
      .from("training_pages")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    return {
      profileId: profile.id as string,
      clinicName: (profile as { clinic_name?: string | null }).clinic_name ?? null,
      courses: list,
      categories: (cats ?? []) as { id: string; name: string; sort_order: number }[],
      page: page ?? null,
    };
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

    const sessionIds = (sessions ?? []).map((s) => s.id);
    const bookingsBySession: Record<string, number> = {};
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

/* ---------------- Availability for training ---------------- */

function toMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fromMin(m: number) {
  const h = Math.floor(m / 60), mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export const getTrainingAvailability = createServerFn({ method: "GET" })
  .inputValidator((i: { courseId: string; date: string; locationId?: string | null }) => i)
  .handler(async ({ data }) => {
    const supabase = getPub();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: course } = await supabase
      .from("training_courses")
      .select("id, profile_id, duration_min, day_count, day_duration_min, scheduling_mode")
      .eq("id", data.courseId)
      .maybeSingle();
    if (!course) throw new Error("Course not found");
    const profileId = course.profile_id;
    const dayCount = Math.max(1, Number((course as { day_count?: number }).day_count ?? 1));
    const perDay = Number((course as { day_duration_min?: number | null }).day_duration_min ?? 0);
    // Multi-day courses book one day at a time, so slots use the per-day length
    const duration = dayCount > 1 && perDay > 0 ? perDay : Number(course.duration_min ?? 120);

    const [y, m, d] = data.date.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

    const [rulesR, overridesR, blockedR, blockedTimesR, apptsR] = await Promise.all([
      supabase.from("availability_rules").select("day_of_week,start_time,end_time,slot_interval,location_id").eq("profile_id", profileId).eq("day_of_week", dow),
      supabase.from("availability_overrides").select("start_time,end_time,slot_interval,location_id").eq("profile_id", profileId).eq("date", data.date),
      supabase.from("blocked_dates").select("id,location_id").eq("profile_id", profileId).eq("date", data.date),
      supabase.from("blocked_times").select("start_time,end_time,location_id").eq("profile_id", profileId).eq("date", data.date),
      supabaseAdmin.from("appointments").select("start_time,end_time,location_id,status").eq("profile_id", profileId).eq("scheduled_date", data.date).neq("status", "cancelled"),
    ]);

    const isBlocked = (blockedR.data ?? []).some((b) => !b.location_id || !data.locationId || b.location_id === data.locationId);
    if (isBlocked) return { slots: [] as Array<{ start: string; end: string }>, duration };

    const busy = [
      ...((apptsR.data ?? []).map((a) => ({ start: toMin(a.start_time), end: toMin(a.end_time), loc: a.location_id }))),
      ...((blockedTimesR.data ?? []).filter((b) => !b.location_id || !data.locationId || b.location_id === data.locationId).map((b) => ({ start: toMin(b.start_time), end: toMin(b.end_time), loc: b.location_id }))),
    ];

    const rules: Array<{ start_time: string; end_time: string; slot_interval: number; location_id: string | null }> = [
      ...((rulesR.data ?? []).filter((r) => !data.locationId || !r.location_id || r.location_id === data.locationId)),
      ...((overridesR.data ?? []).filter((o) => !data.locationId || !o.location_id || o.location_id === data.locationId)),
    ];

    const slots: Array<{ start: string; end: string }> = [];
    for (const r of rules) {
      const step = r.slot_interval ?? duration;
      const start = toMin(r.start_time);
      const end = toMin(r.end_time);
      for (let t = start; t + duration <= end; t += step) {
        const slotEnd = t + duration;
        const overlap = busy.some((b) => (!data.locationId || !b.loc || b.loc === data.locationId) && t < b.end && slotEnd > b.start);
        if (!overlap) slots.push({ start: fromMin(t), end: fromMin(slotEnd) });
      }
    }
    // dedupe
    const seen = new Set<string>();
    const dedup = slots.filter((s) => { if (seen.has(s.start)) return false; seen.add(s.start); return true; })
      .sort((a, b) => a.start.localeCompare(b.start));

    // apply today-cutoff
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (data.date === todayIso) {
      const cutoff = now.getHours() * 60 + now.getMinutes();
      return { slots: dedup.filter((s) => toMin(s.start) >= cutoff), duration };
    }
    return { slots: dedup, duration };
  });

/**
 * Which days in a month have at least one bookable slot for this course.
 * Used to grey out unavailable dates in the public date picker.
 */
export const getTrainingAvailableDays = createServerFn({ method: "GET" })
  .inputValidator((i: { courseId: string; month: string; locationId?: string | null }) => i)
  .handler(async ({ data }) => {
    const supabase = getPub();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: course } = await supabase
      .from("training_courses")
      .select("id, profile_id, duration_min, day_count, day_duration_min")
      .eq("id", data.courseId)
      .maybeSingle();
    if (!course) return { days: [] as string[] };
    const profileId = course.profile_id;
    const dayCount = Math.max(1, Number((course as { day_count?: number }).day_count ?? 1));
    const perDay = Number((course as { day_duration_min?: number | null }).day_duration_min ?? 0);
    // Multi-day courses book one day at a time, so slots use the per-day length
    const duration = dayCount > 1 && perDay > 0 ? perDay : Number(course.duration_min ?? 120);

    const [ys, ms] = data.month.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(ys, ms, 0)).getUTCDate();
    const iso = (d: number) => `${ys}-${String(ms).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const from = iso(1);
    const to = iso(daysInMonth);

    const [rulesR, overridesR, blockedR, blockedTimesR, apptsR] = await Promise.all([
      supabase.from("availability_rules").select("day_of_week,start_time,end_time,slot_interval,location_id").eq("profile_id", profileId),
      supabase.from("availability_overrides").select("date,start_time,end_time,slot_interval,location_id").eq("profile_id", profileId).gte("date", from).lte("date", to),
      supabase.from("blocked_dates").select("date,location_id").eq("profile_id", profileId).gte("date", from).lte("date", to),
      supabase.from("blocked_times").select("date,start_time,end_time,location_id").eq("profile_id", profileId).gte("date", from).lte("date", to),
      supabaseAdmin.from("appointments").select("scheduled_date,start_time,end_time,location_id,status").eq("profile_id", profileId).gte("scheduled_date", from).lte("scheduled_date", to).neq("status", "cancelled"),
    ]);

    const locOk = (loc: string | null) => !data.locationId || !loc || loc === data.locationId;
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const days: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = iso(d);
      if (date < todayIso) continue;
      if ((blockedR.data ?? []).some((b) => b.date === date && locOk(b.location_id))) continue;

      const dow = new Date(Date.UTC(ys, ms - 1, d)).getUTCDay();
      const rules = [
        ...((rulesR.data ?? []).filter((r) => r.day_of_week === dow && locOk(r.location_id))),
        ...((overridesR.data ?? []).filter((o) => o.date === date && locOk(o.location_id))),
      ];
      if (!rules.length) continue;

      const busy = [
        ...((apptsR.data ?? []).filter((a) => a.scheduled_date === date && locOk(a.location_id)).map((a) => ({ start: toMin(a.start_time), end: toMin(a.end_time) }))),
        ...((blockedTimesR.data ?? []).filter((b) => b.date === date && locOk(b.location_id)).map((b) => ({ start: toMin(b.start_time), end: toMin(b.end_time) }))),
      ];

      const cutoff = date === todayIso ? nowMin : 0;
      const has = rules.some((r) => {
        const step = r.slot_interval ?? duration;
        for (let t = toMin(r.start_time); t + duration <= toMin(r.end_time); t += step) {
          if (t < cutoff) continue;
          const end = t + duration;
          if (!busy.some((b) => t < b.end && end > b.start)) return true;
        }
        return false;
      });
      if (has) days.push(date);
    }
    return { days };
  });

export const createTrainingBooking = createServerFn({ method: "POST" })
  .inputValidator((i: {
    course_id: string;
    session_id?: string | null;
    trainee_name: string;
    trainee_email: string;
    trainee_phone?: string;
    prereq_confirmed?: boolean;
    // For 1:1 request (no scheduling):
    preferred_date?: string;
    preferred_start?: string;
    // For availability-based booking:
    appointment_date?: string;
    appointment_start?: string; // HH:MM
    appointment_end?: string;   // HH:MM
    location_id?: string | null;
    notes?: string;
    // Where Stripe should send the trainee back to after checkout.
    slug?: string;
    return_origin?: string;
  }) => i)
  .handler(async ({ data }) => {
    const supabase = getPub();

    const { data: course, error: cErr } = await supabase
      .from("training_courses")
      .select("id, profile_id, mode, scheduling_mode, capacity, active, require_prereq_confirm, visibility, name, duration_min, price")
      .eq("id", data.course_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!course || !course.active) throw new Error("Course is not available");
    if (course.visibility === "hidden" || course.visibility === "coming_soon") {
      throw new Error("This course is not yet open for bookings");
    }

    if (course.require_prereq_confirm && !data.prereq_confirmed) {
      throw new Error("Please confirm you meet the prerequisites");
    }

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

    let appointment_id: string | null = null;
    let appointment_date: string | null = data.preferred_date || null;
    let appointment_start: string | null = data.preferred_start || null;
    let appointment_end: string | null = null;

    {
      const { assertNotDemoPatientBooking } = await import("./demo-guard.server");
      await assertNotDemoPatientBooking(course.profile_id, data.trainee_email);
    }

    // Availability mode: create a real appointment blocking the calendar.
    if (course.scheduling_mode === "availability" && data.appointment_date && data.appointment_start && data.appointment_end) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Conflict check
      const { data: conflicts } = await supabaseAdmin
        .from("appointments")
        .select("id,start_time,end_time,location_id,status")
        .eq("profile_id", course.profile_id)
        .eq("scheduled_date", data.appointment_date)
        .neq("status", "cancelled");
      const startMin = toMin(data.appointment_start);
      const endMin = toMin(data.appointment_end);
      const clash = (conflicts ?? []).some((c) => {
        if (data.location_id && c.location_id && c.location_id !== data.location_id) return false;
        const cs = toMin(c.start_time), ce = toMin(c.end_time);
        return startMin < ce && endMin > cs;
      });
      if (clash) throw new Error("Sorry, that slot was just taken. Please pick another time.");

      const { data: apptRow, error: apptErr } = await supabaseAdmin
        .from("appointments")
        .insert({
          profile_id: course.profile_id,
          patient_name: data.trainee_name.trim(),
          patient_email: data.trainee_email.trim().toLowerCase(),
          patient_phone: data.trainee_phone?.trim() || null,
          scheduled_date: data.appointment_date,
          start_time: `${data.appointment_start}:00`,
          end_time: `${data.appointment_end}:00`,
          location_id: data.location_id ?? null,
          status: "confirmed",
          payment_status: "pending",
          treatment_name_snapshot: `Training — ${course.name}`,
          treatment_price_snapshot: Number(course.price ?? 0),
          base_amount: Number(course.price ?? 0),
          total_amount: Number(course.price ?? 0),
          notes: data.notes?.trim() || null,
        } as never)
        .select("id")
        .single();
      if (apptErr) throw apptErr;
      appointment_id = apptRow.id;
      appointment_date = data.appointment_date;
      appointment_start = `${data.appointment_start}:00`;
      appointment_end = `${data.appointment_end}:00`;
    }

    const insertPayload = {
      course_id: course.id,
      profile_id: course.profile_id,
      session_id: data.session_id ?? null,
      trainee_name: data.trainee_name.trim(),
      trainee_email: data.trainee_email.trim().toLowerCase(),
      trainee_phone: data.trainee_phone?.trim() || null,
      prereq_confirmed: !!data.prereq_confirmed,
      status: appointment_id ? "confirmed" as const : "pending" as const,
      payment_status: "pending",
      appointment_id,
      appointment_date,
      appointment_start,
      appointment_end,
      location_id: data.location_id ?? null,
      notes: data.notes?.trim() || null,
    };

    const { data: row, error } = await supabase
      .from("training_bookings")
      .insert(insertPayload as never)
      .select("id")
      .single();
    if (error) throw error;

    // Fixed-date courses: put the session on the practitioner's calendar too,
    // so training shows up alongside treatments.
    if (!appointment_id && data.session_id) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: sess } = await supabaseAdmin
          .from("training_course_sessions")
          .select("session_date, start_time, end_time, location_id")
          .eq("id", data.session_id)
          .maybeSingle();
        if (sess) {
          const { data: appt } = await supabaseAdmin
            .from("appointments")
            .insert({
              profile_id: course.profile_id,
              patient_name: data.trainee_name.trim(),
              patient_email: data.trainee_email.trim().toLowerCase(),
              patient_phone: data.trainee_phone?.trim() || null,
              scheduled_date: sess.session_date,
              start_time: sess.start_time,
              end_time: sess.end_time,
              location_id: sess.location_id ?? data.location_id ?? null,
              status: "confirmed",
              payment_status: "pending",
              treatment_name_snapshot: `Training — ${course.name}`,
              treatment_price_snapshot: Number(course.price ?? 0),
              base_amount: Number(course.price ?? 0),
              total_amount: Number(course.price ?? 0),
              notes: data.notes?.trim() || null,
            } as never)
            .select("id")
            .single();
          if (appt) {
            appointment_id = appt.id;
            await supabaseAdmin
              .from("training_bookings")
              .update({
                appointment_id: appt.id,
                appointment_date: sess.session_date,
                appointment_start: sess.start_time,
                appointment_end: sess.end_time,
              } as never)
              .eq("id", row.id);
          }
        }
      } catch (e) {
        console.error("[training] calendar appointment failed", e);
      }
    }

    // Take payment online when the clinic has Stripe connected and the course
    // has a price. The webhook confirms the booking once the money lands.
    const price = Number(course.price ?? 0);
    let checkoutUrl: string | null = null;
    if (price > 0 && data.return_origin && data.slug) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("stripe_connect_account_id, clinic_name")
          .eq("id", course.profile_id)
          .maybeSingle();
        if (prof?.stripe_connect_account_id) {
          const { createCheckoutSession } = await import("./stripe.server");
          const base = `${data.return_origin.replace(/\/$/, "")}/m/${data.slug}/training/${course.id}?booking=${row.id}`;
          const session = await createCheckoutSession({
            accountId: prof.stripe_connect_account_id,
            lineItems: [{
              quantity: 1,
              price_data: {
                currency: "gbp",
                unit_amount: Math.round(price * 100),
                product_data: { name: `Training — ${course.name}` },
              },
            }],
            successUrl: `${base}&status=paid`,
            cancelUrl: `${base}&status=cancelled`,
            customerEmail: data.trainee_email.trim().toLowerCase(),
            metadata: {
              kind: "training_booking",
              training_booking_id: row.id,
            },
            descriptorName: prof.clinic_name,
            idempotencyKey: `training-${row.id}`,
          });
          checkoutUrl = session.url ?? null;
        }
      } catch (e) {
        console.error("[training] stripe checkout failed", e);
      }
    }

    // No online payment needed (free course, or clinic not on Stripe): confirm
    // straight away and email the trainee their booking confirmation.
    if (!checkoutUrl && appointment_id) {
      try {
        const { sendBookingConfirmationEmails } = await import("@/lib/email/send.server");
        await sendBookingConfirmationEmails([appointment_id]);
      } catch (e) {
        console.error("[training] confirmation email failed", e);
      }
    }

    return { id: row.id as string, checkoutUrl };

  });
