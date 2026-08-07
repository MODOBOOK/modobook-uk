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

/** How many rooms are taken out of service across [s,e) by closures. */
function blockedUnits(blocks: any[], capacity: number, s: number, e: number) {
  let max = 0;
  for (const b of blocks) {
    const bs = b.start_time ? toMin(b.start_time) : 0;
    const be = b.end_time ? toMin(b.end_time) : 1440;
    if (s < be && e > bs) {
      const u = b.units == null ? capacity : Math.max(0, Number(b.units));
      if (u > max) max = u;
    }
  }
  return Math.min(capacity, max);
}


/** Online-checkout bookings hold the slot for 20 minutes; unpaid after that, they're abandoned. */
const HOLD_MS = 20 * 60 * 1000;
function isUnpaidOnlineHold(b: any) {
  return b?.status === "pending" && b?.payment_mode === "pay_online" && b?.payment_status !== "paid";
}
/** Rows that should count against availability (paid, or still inside their checkout hold). */
function activeBookings(rows: any[]) {
  const now = Date.now();
  return (rows ?? []).filter((b) => {
    if (!isUnpaidOnlineHold(b)) return true;
    const created = b.created_at ? new Date(b.created_at).getTime() : 0;
    return now - created < HOLD_MS;
  });
}

/** Lowest free room number for [s,e), or null when nothing is free. */
function allocateUnit(capacity: number, blocks: any[], bookings: any[], s: number, e: number) {
  const usable = capacity - blockedUnits(blocks, capacity, s, e);
  if (usable <= 0) return null;
  const taken = new Set<number>();
  let unknown = 0;
  for (const b of bookings) {
    if (!(s < toMin(b.end_time) && e > toMin(b.start_time))) continue;
    if (b.unit_index) taken.add(Number(b.unit_index));
    else unknown += 1;
  }
  for (let i = 1; i <= usable; i += 1) {
    if (taken.has(i)) continue;
    if (unknown > 0) { unknown -= 1; continue; }
    return i;
  }
  return null;
}


/* -------------------------------- owner side ------------------------------- */

export const listMyRooms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;
    const { data: profile } = await sb
      .from("profiles").select("id").eq("user_id", uid).maybeSingle();
    const [rooms, hours, blocks, bookings, locations] = await Promise.all([
      sb.from("rental_rooms").select("*").eq("profile_id", uid).order("sort_order").order("created_at"),
      sb.from("rental_hours").select("*").eq("profile_id", uid).order("weekday").order("start_time"),
      sb.from("rental_blocks").select("*").eq("profile_id", uid).order("block_date"),
      sb.from("rental_bookings").select("*").eq("profile_id", uid).order("booking_date", { ascending: false }),
      profile
        ? sb.from("locations").select("id, name").eq("profile_id", profile.id).order("name")
        : Promise.resolve({ data: [] }),
    ]);
    return {
      rooms: rooms.data ?? [],
      hours: hours.data ?? [],
      blocks: blocks.data ?? [],
      bookings: (bookings.data ?? []).filter((b: any) => !isUnpaidOnlineHold(b)),
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
  min_hours: z.number().positive().max(12).optional(),
  quantity: z.number().int().positive().max(50).optional(),
  skip_room_selection: z.boolean().optional(),
  auto_invoice: z.boolean().optional(),
  deposit_percent: z.number().min(0).max(100).nullable().optional(),
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
  .inputValidator((d: { room_id: string | null; block_date: string; start_time?: string | null; end_time?: string | null; reason?: string | null; units?: number | null }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("rental_blocks").insert({
      room_id: data.room_id,
      block_date: data.block_date,
      start_time: data.start_time || null,
      end_time: data.end_time || null,
      reason: data.reason || null,
      units: data.units ?? null,
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
      .select("id,name,description,image_url,location_id,hourly_rate,half_day_rate,full_day_rate,half_day_hours,min_hours,quantity,skip_room_selection,deposit_percent,booking_mode")
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

    const [roomRes, hoursRes, blocksRes, bookingsRes] = await Promise.all([
      supabaseAdmin.from("rental_rooms").select("quantity").eq("id", data.room_id).maybeSingle(),
      supabaseAdmin.from("rental_hours").select("start_time,end_time").eq("room_id", data.room_id).eq("weekday", weekday),
      supabaseAdmin.from("rental_blocks").select("start_time,end_time,units").eq("block_date", data.date)
        .or(`room_id.eq.${data.room_id},room_id.is.null`),
      supabaseAdmin.from("rental_bookings").select("start_time,end_time,status,payment_status,payment_mode,created_at")
        .eq("room_id", data.room_id).eq("booking_date", data.date).neq("status", "cancelled"),
    ]);

    const capacity = Math.max(1, Number((roomRes.data as any)?.quantity ?? 1));
    const closedBlocks = (blocksRes.data ?? []) as any[];
    const booked = activeBookings((bookingsRes.data ?? []) as any[]);

    const slots: { start: string; end: string; available: boolean; free: number }[] = [];
    for (const h of (hoursRes.data ?? []) as any[]) {
      for (let m = toMin(h.start_time); m + 60 <= toMin(h.end_time); m += 60) {
        const usable = capacity - blockedUnits(closedBlocks, capacity, m, m + 60);
        const used = booked.filter((b) => m < toMin(b.end_time) && m + 60 > toMin(b.start_time)).length;
        const free = Math.max(0, usable - used);
        slots.push({ start: fromMin(m), end: fromMin(m + 60), available: free > 0, free });
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

    // Capacity guard + auto-allocation (a room entry can represent several identical rooms)
    const capacity = Math.max(1, Number((room as any).quantity ?? 1));
    const [clashesRes, blocksRes2] = await Promise.all([
      supabaseAdmin.from("rental_bookings").select("start_time,end_time,unit_index,status,payment_status,payment_mode,created_at")
        .eq("room_id", data.room_id).eq("booking_date", data.booking_date).neq("status", "cancelled"),
      supabaseAdmin.from("rental_blocks").select("start_time,end_time,units").eq("block_date", data.booking_date)
        .or(`room_id.eq.${data.room_id},room_id.is.null`),
    ]);
    const unitIndex = allocateUnit(
      capacity,
      (blocksRes2.data ?? []) as any[],
      activeBookings((clashesRes.data ?? []) as any[]),
      toMin(data.start_time),
      toMin(data.end_time),
    );
    if (unitIndex == null) throw new Error("That time has just been taken — please pick another slot");



    let price = 0;
    if (data.unit === "half_day") price = Number(room.half_day_rate ?? 0);
    else if (data.unit === "full_day") price = Number(room.full_day_rate ?? 0);
    else price = Number(room.hourly_rate ?? 0) * hours;

    const mode = room.booking_mode as "enquiry" | "pay_online" | "pay_in_clinic";
    const status = mode === "enquiry" ? "pending" : mode === "pay_in_clinic" ? "confirmed" : "pending";

    // Optional deposit: charge a % of the total online, balance settled with the clinic.
    const pct = Number((room as any).deposit_percent ?? 0);
    const takesDeposit = mode === "pay_online" && pct > 0 && pct < 100;
    const chargeAmount = takesDeposit ? Math.round(price * pct) / 100 : price;

    const { data: booking, error } = await supabaseAdmin
      .from("rental_bookings")
      .insert({
        profile_id: prof.user_id,
        room_id: room.id,
        booking_date: data.booking_date,
        start_time: data.start_time,
        end_time: data.end_time,
        unit: data.unit,
        unit_index: unitIndex,
        hours,
        price,
        deposit_amount: takesDeposit ? chargeAmount : null,
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
      if ((room as any).auto_invoice) {
        try {
          const { data: full } = await supabaseAdmin.from("rental_bookings").select("*").eq("id", booking.id).maybeSingle();
          await sendRentalInvoiceEmail({
            sb: supabaseAdmin,
            userId: prof.user_id,
            profileId: prof.id,
            booking: full,
            roomName: room.name,
          });
        } catch (e) {
          console.error("[room-rental] auto invoice failed", e);
        }
      }
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
            unit_amount: Math.round(chargeAmount * 100),
            product_data: {
              name: takesDeposit
                ? `Deposit (${pct}%) — ${room.name} (${data.booking_date} ${hhmm(data.start_time)}–${hhmm(data.end_time)})`
                : `Room hire — ${room.name} (${data.booking_date} ${hhmm(data.start_time)}–${hhmm(data.end_time)})`,
            },
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

/* --------------------------- owner-side scheduling -------------------------- */

/** Availability grid for the signed-in clinic (works even when the public page is off). */
export const getOwnerRoomAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { room_id: string; date: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const weekday = new Date(`${data.date}T12:00:00`).getDay();
    const [roomRes, hoursRes, blocksRes, bookingsRes] = await Promise.all([
      sb.from("rental_rooms").select("quantity").eq("id", data.room_id).maybeSingle(),
      sb.from("rental_hours").select("start_time,end_time").eq("room_id", data.room_id).eq("weekday", weekday),
      sb.from("rental_blocks").select("start_time,end_time,units").eq("block_date", data.date)
        .or(`room_id.eq.${data.room_id},room_id.is.null`),
      sb.from("rental_bookings").select("start_time,end_time,status,payment_status,payment_mode,created_at")
        .eq("room_id", data.room_id).eq("booking_date", data.date).neq("status", "cancelled"),
    ]);
    const capacity = Math.max(1, Number(roomRes.data?.quantity ?? 1));
    const closedBlocks = (blocksRes.data ?? []) as any[];
    const booked = activeBookings((bookingsRes.data ?? []) as any[]);
    const slots: { start: string; end: string; available: boolean; free: number }[] = [];
    for (const h of (hoursRes.data ?? []) as any[]) {
      for (let m = toMin(h.start_time); m + 60 <= toMin(h.end_time); m += 60) {
        const usable = capacity - blockedUnits(closedBlocks, capacity, m, m + 60);
        const used = booked.filter((b: any) => m < toMin(b.end_time) && m + 60 > toMin(b.start_time)).length;
        const free = Math.max(0, usable - used);
        slots.push({ start: fromMin(m), end: fromMin(m + 60), available: free > 0, free });
      }
    }
    return { slots, capacity };
  });

async function ownerProfile(sb: any, uid: string) {
  const { data } = await sb
    .from("profiles")
    .select("id, slug, clinic_name, email, stripe_connect_account_id")
    .eq("user_id", uid)
    .maybeSingle();
  return data;
}

/** Build a Stripe checkout link for a rental booking and (optionally) email it. */
async function buildRentalPaymentLink(opts: {
  prof: any;
  booking: any;
  roomName: string;
  amount: number;
  origin: string;
}) {
  if (!opts.prof?.stripe_connect_account_id) {
    throw new Error("Connect Stripe in Payments before sending payment links");
  }
  if (!(opts.amount > 0)) throw new Error("Set an amount greater than £0");
  const { createCheckoutSession } = await import("./stripe.server");
  const base = `${opts.origin.replace(/\/$/, "")}/m/${opts.prof.slug}/roomrental?booking=${opts.booking.id}`;
  const session = await createCheckoutSession({
    accountId: opts.prof.stripe_connect_account_id,
    lineItems: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: Math.round(opts.amount * 100),
          product_data: {
            name: `Room hire — ${opts.roomName} (${opts.booking.booking_date} ${hhmm(opts.booking.start_time)}–${hhmm(opts.booking.end_time)})`,
          },
        },
      },
    ],
    successUrl: `${base}&status=paid`,
    cancelUrl: `${base}&status=cancelled`,
    customerEmail: opts.booking.renter_email,
    metadata: {
      kind: "room_rental_booking",
      rental_booking_id: opts.booking.id,
      profile_id: opts.prof.user_id ?? "",
    },
    descriptorName: opts.prof.clinic_name,
  });
  if (!session.url) throw new Error("Could not create a payment link");
  return session.url as string;
}

async function emailRenter(opts: {
  profileId: string;
  to: string;
  replyTo?: string | null;
  subject: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
}) {
  const { enqueueAppEmail, getPractitionerBranding } = await import("./email/send.server");
  const branding = await getPractitionerBranding(opts.profileId);
  await enqueueAppEmail({
    templateName: "patient-message",
    recipientEmail: opts.to,
    replyTo: opts.replyTo || undefined,
    templateData: {
      subject: opts.subject,
      body: opts.body,
      clinicName: branding.clinicName,
      logoUrl: branding.logoUrl,
      brandColor: branding.brandColor,
      profileId: opts.profileId,
      actions: opts.actionUrl ? [{ label: opts.actionLabel || "Pay now", url: opts.actionUrl, variant: "primary" }] : undefined,
    },
  });
}


/** Branded invoice email for a rental booking — same layout as patient invoices. */
async function sendRentalInvoiceEmail(opts: {
  sb: any;
  userId: string;
  profileId: string;
  booking: any;
  roomName: string;
  origin?: string | null;
  message?: string | null;
  payUrl?: string | null;
}) {
  const { sb, booking } = opts;
  const { data: p } = await sb
    .from("profiles")
    .select(
      "clinic_name, full_name, email, phone, address, invoice_bank_name, invoice_account_name, invoice_sort_code, invoice_account_number, invoice_iban, invoice_swift, invoice_payment_reference, invoice_footer_notes, invoice_vat_number, invoice_company_number, invoice_show_bank_details",
    )
    .eq("user_id", opts.userId)
    .maybeSingle();

  const clinicName = p?.clinic_name || p?.full_name || "your clinic";
  const total = Number(booking.price ?? 0);
  const paid = booking.payment_status === "paid" ? total : 0;
  const due = Math.max(0, total - paid);
  const when = `${booking.booking_date} · ${hhmm(booking.start_time)}–${hhmm(booking.end_time)}`;
  const reference = String(booking.id).slice(0, 8).toUpperCase();

  const addr = (p?.address ?? {}) as Record<string, string>;
  const addressLines = [addr.line1, addr.line2, [addr.city, addr.postcode].filter(Boolean).join(" "), addr.country]
    .filter(Boolean)
    .join("\n");

  const bank =
    p?.invoice_show_bank_details
      ? [
          "\nBank transfer",
          p.invoice_account_name ? `Account name: ${p.invoice_account_name}` : null,
          p.invoice_bank_name ? `Bank: ${p.invoice_bank_name}` : null,
          p.invoice_sort_code ? `Sort code: ${p.invoice_sort_code}` : null,
          p.invoice_account_number ? `Account number: ${p.invoice_account_number}` : null,
          p.invoice_iban ? `IBAN: ${p.invoice_iban}` : null,
          p.invoice_swift ? `SWIFT/BIC: ${p.invoice_swift}` : null,
          `Reference: ${p.invoice_payment_reference || reference}`,
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  const note = opts.message?.trim() ? `${opts.message.trim()}\n\n` : "";
  const body =
    `Hi ${booking.renter_name || "there"},\n\n` +
    `${note}Please find your invoice from ${clinicName} below.\n\n` +
    `Invoice ${reference} · ${new Date().toLocaleDateString("en-GB")}\n\n` +
    `• Room hire — ${opts.roomName}${booking.unit_index ? ` (Room ${booking.unit_index})` : ""}, ${when} — £${total.toFixed(2)}\n\n` +
    `Total: £${total.toFixed(2)}\n` +
    (paid > 0 ? `Already paid: £${paid.toFixed(2)}\n` : "") +
    `Amount due: £${due.toFixed(2)}\n` +
    (bank ? `${bank}\n` : "") +
    (addressLines ? `\n${clinicName}\n${addressLines}\n` : "") +
    (p?.invoice_vat_number ? `VAT no. ${p.invoice_vat_number}\n` : "") +
    (p?.invoice_company_number ? `Company no. ${p.invoice_company_number}\n` : "") +
    (p?.invoice_footer_notes ? `\n${p.invoice_footer_notes}\n` : "") +
    `\nThank you,\n${p?.full_name || clinicName}`;

  await emailRenter({
    profileId: opts.profileId,
    to: booking.renter_email,
    replyTo: p?.email ?? null,
    subject: `Invoice ${reference} from ${clinicName}`,
    body,
    actionLabel: `Pay £${due.toFixed(2)}`,
    actionUrl: due > 0 ? opts.payUrl || undefined : undefined,
  });

  await sb.from("rental_bookings").update({ invoice_sent_at: new Date().toISOString() }).eq("id", booking.id);
}

/** Auto-invoice used by the payment webhook once a rental payment clears. */
export async function sendRentalInvoiceForBooking(bookingId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;
  const { data: booking } = await sb.from("rental_bookings").select("*").eq("id", bookingId).maybeSingle();
  if (!booking) return;
  if (booking.invoice_sent_at) return; // already invoiced — never send twice
  const { data: room } = await sb.from("rental_rooms").select("name, auto_invoice").eq("id", booking.room_id).maybeSingle();
  if (!room?.auto_invoice) return;
  const { data: prof } = await sb.from("profiles").select("id").eq("user_id", booking.profile_id).maybeSingle();
  if (!prof) return;
  await sendRentalInvoiceEmail({
    sb,
    userId: booking.profile_id,
    profileId: prof.id,
    booking,
    roomName: room.name ?? "Room",
  });
}

/** Send (or resend) the invoice for a booking to the practitioner who hired the room. */
export const sendRentalInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; origin: string; message?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;
    const prof = await ownerProfile(sb, uid);
    if (!prof) throw new Error("Profile not found");
    const { data: booking } = await sb
      .from("rental_bookings").select("*").eq("id", data.id).eq("profile_id", uid).maybeSingle();
    if (!booking) throw new Error("Booking not found");
    const { data: room } = await sb.from("rental_rooms").select("name").eq("id", booking.room_id).maybeSingle();

    let payUrl: string | null = null;
    const due = Number(booking.price ?? 0);
    if (booking.payment_status !== "paid" && due > 0 && prof.stripe_connect_account_id) {
      try {
        payUrl = await buildRentalPaymentLink({
          prof: { ...prof, user_id: uid },
          booking,
          roomName: room?.name ?? "Room",
          amount: due,
          origin: data.origin,
        });
      } catch (e) {
        console.error("[room-rental] invoice payment link failed", e);
      }
    }

    await sendRentalInvoiceEmail({
      sb,
      userId: uid,
      profileId: prof.id,
      booking,
      roomName: room?.name ?? "Room",
      origin: data.origin,
      message: data.message ?? null,
      payUrl,
    });
    return { ok: true };
  });

const manualBookingSchema = z.object({
  room_id: z.string().uuid(),
  booking_date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  unit: z.enum(["hour", "half_day", "full_day"]),
  price: z.number().nonnegative(),
  renter_name: z.string().min(1).max(120),
  renter_email: z.string().email(),
  renter_phone: z.string().max(40).nullable().optional(),
  renter_business: z.string().max(160).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  /** none = just book it, payment_link = email a Stripe link, confirmation = email details only */
  send: z.enum(["none", "payment_link", "confirmation"]).default("none"),
  /** Optional personal note from the clinic, shown at the top of the email. */
  message: z.string().max(2000).nullable().optional(),
  origin: z.string().url(),
});

/** Practitioner books a renter in themselves, optionally emailing a payment link. */
export const createManualRentalBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => manualBookingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;
    const prof = await ownerProfile(sb, uid);
    if (!prof) throw new Error("Profile not found");

    const { data: room } = await sb
      .from("rental_rooms").select("*").eq("id", data.room_id).eq("profile_id", uid).maybeSingle();
    if (!room) throw new Error("Room not found");

    const hours = (toMin(data.end_time) - toMin(data.start_time)) / 60;
    if (hours <= 0) throw new Error("Invalid time range");

    const capacity = Math.max(1, Number(room.quantity ?? 1));
    const [clashesRes, blockRes] = await Promise.all([
      sb.from("rental_bookings").select("start_time,end_time,unit_index,status,payment_status,payment_mode,created_at")
        .eq("room_id", data.room_id).eq("booking_date", data.booking_date).neq("status", "cancelled"),
      sb.from("rental_blocks").select("start_time,end_time,units").eq("block_date", data.booking_date)
        .or(`room_id.eq.${data.room_id},room_id.is.null`),
    ]);
    const unitIndex = allocateUnit(
      capacity,
      (blockRes.data ?? []) as any[],
      activeBookings((clashesRes.data ?? []) as any[]),
      toMin(data.start_time),
      toMin(data.end_time),
    );
    if (unitIndex == null) throw new Error("That time is already fully booked");

    const { data: booking, error } = await sb
      .from("rental_bookings")
      .insert({
        profile_id: uid,
        room_id: room.id,
        booking_date: data.booking_date,
        start_time: data.start_time,
        end_time: data.end_time,
        unit: data.unit,
        unit_index: unitIndex,
        hours,
        price: data.price,
        status: "confirmed",
        payment_status: "unpaid",
        payment_mode: data.send === "payment_link" ? "pay_online" : room.booking_mode,
        renter_name: data.renter_name,
        renter_email: data.renter_email,
        renter_phone: data.renter_phone ?? null,
        renter_business: data.renter_business ?? null,
        notes: data.notes ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    const when = `${data.booking_date} · ${hhmm(data.start_time)}–${hhmm(data.end_time)}`;
    const note = data.message?.trim() ? `${data.message.trim()}\n\n` : "";
    let checkoutUrl: string | null = null;

    if (data.send === "payment_link") {
      checkoutUrl = await buildRentalPaymentLink({
        prof: { ...prof, user_id: uid },
        booking,
        roomName: room.name,
        amount: data.price,
        origin: data.origin,
      });
      await sb.from("rental_bookings").update({ stripe_session_id: null }).eq("id", booking.id);
      await emailRenter({
        profileId: prof.id,
        to: data.renter_email,
        replyTo: prof.email,
        subject: `Your room booking — ${when}`,
        body: `Hi ${data.renter_name},\n\n${note}Your room hire is booked:\n\n${room.name}${unitIndex && capacity > 1 ? ` — Room ${unitIndex}` : ""}\n${when}\nTotal £${Number(data.price).toFixed(2)}\n\nPlease complete payment using the button below to secure the room.`,
        actionLabel: `Pay £${Number(data.price).toFixed(2)}`,
        actionUrl: checkoutUrl,
      });
    } else if (data.send === "confirmation") {
      await emailRenter({
        profileId: prof.id,
        to: data.renter_email,
        replyTo: prof.email,
        subject: `Your room booking — ${when}`,
        body: `Hi ${data.renter_name},\n\n${note}Your room hire is confirmed:\n\n${room.name}${unitIndex && capacity > 1 ? ` — Room ${unitIndex}` : ""}\n${when}\nTotal £${Number(data.price).toFixed(2)}\n\nSee you then.`,
      });
    }

    if (room.auto_invoice) {
      try {
        await sendRentalInvoiceEmail({
          sb,
          userId: uid,
          profileId: prof.id,
          booking,
          roomName: room.name,
          message: data.message ?? null,
          payUrl: checkoutUrl,
        });
      } catch (e) {
        console.error("[room-rental] auto invoice failed", e);
      }
    }

    return { id: booking.id as string, checkoutUrl };
  });

/** Email (or just generate) a Stripe payment link for an existing rental booking. */
export const sendRentalPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; amount?: number | null; origin: string; email?: boolean; message?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;
    const prof = await ownerProfile(sb, uid);
    if (!prof) throw new Error("Profile not found");
    const { data: booking } = await sb
      .from("rental_bookings").select("*").eq("id", data.id).eq("profile_id", uid).maybeSingle();
    if (!booking) throw new Error("Booking not found");
    const { data: room } = await sb.from("rental_rooms").select("name").eq("id", booking.room_id).maybeSingle();

    const amount = Number(data.amount ?? booking.deposit_amount ?? booking.price ?? 0);
    const url = await buildRentalPaymentLink({
      prof: { ...prof, user_id: uid },
      booking,
      roomName: room?.name ?? "Room",
      amount,
      origin: data.origin,
    });

    if (data.email !== false) {
      const when = `${booking.booking_date} · ${hhmm(booking.start_time)}–${hhmm(booking.end_time)}`;
      await emailRenter({
        profileId: prof.id,
        to: booking.renter_email,
        replyTo: prof.email,
        subject: `Payment for your room booking — ${when}`,
        body: `Hi ${booking.renter_name},\n\n${data.message?.trim() ? `${data.message.trim()}\n\n` : ""}Here's the payment link for your room hire:\n\n${room?.name ?? "Room"}\n${when}\nAmount due £${amount.toFixed(2)}\n\nTap below to pay securely.`,
        actionLabel: `Pay £${amount.toFixed(2)}`,
        actionUrl: url,
      });
    }
    return { url };
  });

/* --------------------------- month calendar blocking ------------------------ */

/**
 * Which dates in a month can't be booked (clinic closed, fully blocked, or fully booked).
 * `hours` lets the calendar grey out days with no window long enough for the chosen slot.
 */
export const getRoomMonthAvailability = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; room_id: string; month: string; hours?: number }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin, prof } = await resolveClinic(data.slug);
    if (!prof?.room_rental_enabled) return { unavailable: [] as string[] };

    const [y, m] = data.month.split("-").map(Number);
    if (!y || !m) return { unavailable: [] as string[] };
    const first = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const last = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const need = Math.max(1, Math.ceil(Number(data.hours ?? 1)));

    const [roomRes, hoursRes, blocksRes, bookingsRes] = await Promise.all([
      supabaseAdmin.from("rental_rooms").select("quantity").eq("id", data.room_id).maybeSingle(),
      supabaseAdmin.from("rental_hours").select("weekday,start_time,end_time").eq("room_id", data.room_id),
      supabaseAdmin.from("rental_blocks").select("block_date,start_time,end_time,units")
        .gte("block_date", first).lte("block_date", last)
        .or(`room_id.eq.${data.room_id},room_id.is.null`),
      supabaseAdmin.from("rental_bookings")
        .select("booking_date,start_time,end_time,status,payment_status,payment_mode,created_at")
        .eq("room_id", data.room_id).gte("booking_date", first).lte("booking_date", last)
        .neq("status", "cancelled"),
    ]);

    const capacity = Math.max(1, Number((roomRes.data as any)?.quantity ?? 1));
    const openHours = (hoursRes.data ?? []) as any[];
    const allBlocks = (blocksRes.data ?? []) as any[];
    const allBookings = activeBookings((bookingsRes.data ?? []) as any[]);

    const unavailable: string[] = [];
    for (let d = 1; d <= lastDay; d += 1) {
      const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const weekday = new Date(`${date}T12:00:00`).getDay();
      const dayHours = openHours.filter((h) => Number(h.weekday) === weekday);
      if (dayHours.length === 0) { unavailable.push(date); continue; }

      const blocks = allBlocks.filter((b) => b.block_date === date);
      const booked = allBookings.filter((b) => b.booking_date === date);

      // Build the hourly grid, then look for `need` contiguous free hours.
      let run = 0;
      let ok = false;
      for (const h of dayHours) {
        run = 0;
        for (let mm = toMin(h.start_time); mm + 60 <= toMin(h.end_time); mm += 60) {
          const usable = capacity - blockedUnits(blocks, capacity, mm, mm + 60);
          const used = booked.filter((b: any) => mm < toMin(b.end_time) && mm + 60 > toMin(b.start_time)).length;
          run = usable - used > 0 ? run + 1 : 0;
          if (run >= need) { ok = true; break; }
        }
        if (ok) break;
      }
      if (!ok) unavailable.push(date);
    }
    return { unavailable };
  });

/* ------------------- confirm a rental payment on return ---------------------- */

/**
 * Called when the renter lands back from Stripe. Verifies the session, marks the
 * booking paid and fires the invoice straight away (the webhook does the same —
 * both paths are idempotent, so whichever arrives first wins).
 */
export const confirmRentalPayment = createServerFn({ method: "POST" })
  .inputValidator((d: { booking_id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: booking } = await sb
      .from("rental_bookings").select("*").eq("id", data.booking_id).maybeSingle();
    if (!booking) return { paid: false };
    if (booking.payment_status === "paid") {
      await sendRentalInvoiceForBooking(booking.id);
      return { paid: true };
    }
    if (!booking.stripe_session_id) return { paid: false };

    const { data: prof } = await sb
      .from("profiles").select("stripe_connect_account_id").eq("user_id", booking.profile_id).maybeSingle();
    if (!prof?.stripe_connect_account_id) return { paid: false };

    try {
      const { getStripe } = await import("./stripe.server");
      const session = await getStripe().checkout.sessions.retrieve(
        booking.stripe_session_id,
        { stripeAccount: prof.stripe_connect_account_id },
      );
      if (session.payment_status !== "paid") return { paid: false };
      await sb.from("rental_bookings")
        .update({ payment_status: "paid", status: "confirmed" })
        .eq("id", booking.id).neq("payment_status", "paid");
      await sendRentalInvoiceForBooking(booking.id);
      return { paid: true };
    } catch (e) {
      console.error("[room-rental] confirm payment failed", e);
      return { paid: false };
    }
  });
