import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---------------------------------- utils --------------------------------- */

function hhmm(t: string) {
  return t.slice(0, 5);
}
function toMin(t: string) {
  const [h, m] = hhmm(t).split(":").map(Number);
  return h * 60 + m;
}
function fromMin(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/* -------------------------------- owner side ------------------------------- */

export const listMyRooms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;
    const [rooms, hours, blocks, bookings, locations] = await Promise.all([
      sb.from("rental_rooms").select("*").eq("profile_id", uid).order("sort_order").order("created_at"),
      sb.from("rental_hours").select("*").eq("profile_id", uid).order("weekday").order("start_time"),
      sb.from("rental_blocks").select("*").eq("profile_id", uid).order("block_date"),
      sb.from("rental_bookings").select("*").eq("profile_id", uid).order("booking_date", { ascending: false }),
      sb.from("locations").select("id, name").order("name"),
    ]);
    return {
      rooms: rooms.data ?? [],
      hours: hours.data ?? [],
      blocks: blocks.data ?? [],
      bookings: bookings.data ?? [],
      locations: locations.data ?? [],
    };
  });

const roomSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(3000).nullable().optional(),
  image_url: z.string().nullable().optional(),
  location_id: z.string().uuid().nullable().optional(),
  hourly_rate: z.number().nonnegative().nullable().optional(),
  half_day_rate: z.number().nonnegative().nullable().optional(),
  full_day_rate: z.number().nonnegative().nullable().optional(),
  half_day_hours: z.number().int().positive().max(12).optional(),
  min_hours: z.number().int().positive().max(12).optional(),
  booking_mode: z.enum(["enquiry", "pay_online", "pay_in_clinic"]),
  active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export const upsertRentalRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => roomSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const row = { ...data, profile_id: context.userId };
    if (data.id) {
      const { error } = await sb.from("rental_rooms").update(row).eq("id", data.id).eq("profile_id", context.userId);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await sb.from("rental_rooms").insert(row).select("id").single();
    if (error) throw error;
    return { id: ins.id as string };
  });

export const deleteRentalRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("rental_rooms").delete().eq("id", data.id).eq("profile_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const saveRentalHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { room_id: string; hours: { weekday: number; start_time: string; end_time: string }[] }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await sb.from("rental_hours").delete().eq("room_id", data.room_id).eq("profile_id", context.userId);
    if (data.hours.length) {
      const { error } = await sb.from("rental_hours").insert(
        data.hours.map((h) => ({ ...h, room_id: data.room_id, profile_id: context.userId })),
      );
      if (error) throw error;
    }
    return { ok: true };
  });

export const addRentalBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { room_id: string | null; block_date: string; start_time?: string | null; end_time?: string | null; reason?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("rental_blocks").insert({
      room_id: data.room_id,
      block_date: data.block_date,
      start_time: data.start_time || null,
      end_time: data.end_time || null,
      reason: data.reason || null,
      profile_id: context.userId,
    });
    if (error) throw error;
    return { ok: true };
  });

export const deleteRentalBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("rental_blocks").delete().eq("id", data.id).eq("profile_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const updateRentalBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status?: "pending" | "confirmed" | "cancelled"; payment_status?: "unpaid" | "paid" | "refunded" }) => d)
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.status) patch.status = data.status;
    if (data.payment_status) patch.payment_status = data.payment_status;
    const { error } = await (context.supabase as any)
      .from("rental_bookings").update(patch).eq("id", data.id).eq("profile_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/** Toggle the room-rental page on/off for the signed-in clinic. */
export const setRoomRentalEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("profiles").update({ room_rental_enabled: data.enabled }).eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/* -------------------------------- public side ------------------------------ */

async function resolveClinic(slug: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: prof } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id, user_id, slug, clinic_name, email, room_rental_enabled, stripe_connect_account_id")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  return { supabaseAdmin: supabaseAdmin as any, prof };
}

export const getPublicRooms = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin, prof } = await resolveClinic(data.slug);
    if (!prof) return { enabled: false, clinicName: null, rooms: [], locations: [] };
    if (!prof.room_rental_enabled) return { enabled: false, clinicName: prof.clinic_name, rooms: [], locations: [] };
    const { data: rooms } = await supabaseAdmin
      .from("rental_rooms")
      .select("id,name,description,image_url,location_id,hourly_rate,half_day_rate,full_day_rate,half_day_hours,min_hours,booking_mode")
      .eq("profile_id", prof.user_id)
      .eq("active", true)
      .order("sort_order");
    const { data: locations } = await supabaseAdmin
      .from("locations").select("id, name, city").eq("profile_id", prof.id);
    return {
      enabled: true,
      clinicName: prof.clinic_name as string | null,
      rooms: rooms ?? [],
      locations: locations ?? [],
    };
  });

/** Hourly availability grid for one room on one date. */
export const getRoomAvailability = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; room_id: string; date: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin, prof } = await resolveClinic(data.slug);
    if (!prof?.room_rental_enabled) return { slots: [] };
    const weekday = new Date(`${data.date}T12:00:00`).getDay();

    const [hoursRes, blocksRes, bookingsRes] = await Promise.all([
      supabaseAdmin.from("rental_hours").select("start_time,end_time").eq("room_id", data.room_id).eq("weekday", weekday),
      supabaseAdmin.from("rental_blocks").select("start_time,end_time").eq("block_date", data.date)
        .or(`room_id.eq.${data.room_id},room_id.is.null`),
      supabaseAdmin.from("rental_bookings").select("start_time,end_time")
        .eq("room_id", data.room_id).eq("booking_date", data.date).neq("status", "cancelled"),
    ]);

    const busy: [number, number][] = [
      ...((blocksRes.data ?? []) as any[]).map((b) =>
        b.start_time && b.end_time ? ([toMin(b.start_time), toMin(b.end_time)] as [number, number]) : ([0, 1440] as [number, number]),
      ),
      ...((bookingsRes.data ?? []) as any[]).map((b) => [toMin(b.start_time), toMin(b.end_time)] as [number, number]),
    ];

    const slots: { start: string; end: string; available: boolean }[] = [];
    for (const h of (hoursRes.data ?? []) as any[]) {
      for (let m = toMin(h.start_time); m + 60 <= toMin(h.end_time); m += 60) {
        const clash = busy.some(([s, e]) => m < e && m + 60 > s);
        slots.push({ start: fromMin(m), end: fromMin(m + 60), available: !clash });
      }
    }
    return { slots };
  });

const bookingSchema = z.object({
  slug: z.string(),
  room_id: z.string().uuid(),
  booking_date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  unit: z.enum(["hour", "half_day", "full_day"]),
  renter_name: z.string().min(1).max(120),
  renter_email: z.string().email(),
  renter_phone: z.string().max(40).optional().nullable(),
  renter_business: z.string().max(160).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  return_origin: z.string().url(),
});

export const requestRoomBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => bookingSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin, prof } = await resolveClinic(data.slug);
    if (!prof?.room_rental_enabled) throw new Error("Room rental is not available for this clinic");

    const { data: room } = await supabaseAdmin
      .from("rental_rooms").select("*").eq("id", data.room_id).eq("profile_id", prof.user_id).eq("active", true).maybeSingle();
    if (!room) throw new Error("Room not available");

    const hours = (toMin(data.end_time) - toMin(data.start_time)) / 60;
    if (hours <= 0) throw new Error("Invalid time range");

    // Double-booking guard
    const { data: clashes } = await supabaseAdmin
      .from("rental_bookings").select("start_time,end_time")
      .eq("room_id", data.room_id).eq("booking_date", data.booking_date).neq("status", "cancelled");
    const overlap = ((clashes ?? []) as any[]).some(
      (b) => toMin(data.start_time) < toMin(b.end_time) && toMin(data.end_time) > toMin(b.start_time),
    );
    if (overlap) throw new Error("That time has just been taken — please pick another slot");

    let price = 0;
    if (data.unit === "half_day") price = Number(room.half_day_rate ?? 0);
    else if (data.unit === "full_day") price = Number(room.full_day_rate ?? 0);
    else price = Number(room.hourly_rate ?? 0) * hours;

    const mode = room.booking_mode as "enquiry" | "pay_online" | "pay_in_clinic";
    const status = mode === "enquiry" ? "pending" : mode === "pay_in_clinic" ? "confirmed" : "pending";

    const { data: booking, error } = await supabaseAdmin
      .from("rental_bookings")
      .insert({
        profile_id: prof.user_id,
        room_id: room.id,
        booking_date: data.booking_date,
        start_time: data.start_time,
        end_time: data.end_time,
        unit: data.unit,
        hours,
        price,
        status,
        payment_status: "unpaid",
        payment_mode: mode,
        renter_name: data.renter_name,
        renter_email: data.renter_email,
        renter_phone: data.renter_phone ?? null,
        renter_business: data.renter_business ?? null,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;

    try {
      await supabaseAdmin.rpc("create_notification", {
        p_profile_id: prof.id,
        p_type: "room_rental",
        p_title: "New room rental request",
        p_body: `${data.renter_name} — ${room.name} on ${data.booking_date} ${hhmm(data.start_time)}–${hhmm(data.end_time)}`,
        p_emoji: "🚪",
        p_link: "/dashboard/room-rental",
        p_entity_type: "rental_booking",
        p_entity_id: booking.id,
      });
    } catch (e) {
      console.error("[room-rental] notification failed", e);
    }

    if (mode !== "pay_online") {
      return { id: booking.id as string, checkoutUrl: null as string | null, status };
    }

    if (!prof.stripe_connect_account_id) throw new Error("This clinic isn't accepting online payments yet");
    if (!(price > 0)) throw new Error("This room has no price set for that option");

    const { createCheckoutSession } = await import("./stripe.server");
    const returnUrl = `${data.return_origin.replace(/\/$/, "")}/m/${data.slug}/roomrental?booking=${booking.id}`;
    const session = await createCheckoutSession({
      accountId: prof.stripe_connect_account_id,
      lineItems: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(price * 100),
            product_data: { name: `Room hire — ${room.name} (${data.booking_date} ${hhmm(data.start_time)}–${hhmm(data.end_time)})` },
          },
        },
      ],
      successUrl: `${returnUrl}&status=paid`,
      cancelUrl: `${returnUrl}&status=cancelled`,
      customerEmail: data.renter_email,
      metadata: {
        kind: "room_rental_booking",
        rental_booking_id: booking.id,
        profile_id: prof.user_id,
      },
      descriptorName: prof.clinic_name,
    });

    await supabaseAdmin.from("rental_bookings").update({ stripe_session_id: session.id }).eq("id", booking.id);
    if (!session.url) throw new Error("Could not create checkout session");
    return { id: booking.id as string, checkoutUrl: session.url as string, status };
  });
