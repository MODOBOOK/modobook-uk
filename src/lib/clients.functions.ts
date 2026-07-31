import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    const { data, error } = await context.supabase
      .from("clinic_clients").select("*").eq("profile_id", profileId).eq("archived", false).order("full_name");
    if (error) throw error;
    return data ?? [];
  });

export const listArchivedClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    const { data, error } = await context.supabase
      .from("clinic_clients").select("*").eq("profile_id", profileId).eq("archived", true).order("full_name");
    if (error) throw error;
    return data ?? [];
  });

export const restoreClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("No profile");
    const { error } = await context.supabase
      .from("clinic_clients").update({ archived: false }).eq("id", data.id).eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });

export const permanentlyDeleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("No profile");
    const { error } = await context.supabase
      .from("clinic_clients").delete().eq("id", data.id).eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });

export const getClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("No profile");
    const { data: row, error } = await context.supabase
      .from("clinic_clients").select("*").eq("id", data.id).eq("profile_id", profileId).maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Not found");
    return row;
  });

type UpsertInput = {
  id?: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  dob?: string | null;
  gender?: string | null;
  address?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postcode?: string | null;
  county?: string | null;
  preferred_contact?: string | null;
  marketing_opt_in?: boolean;
  how_heard?: string | null;
  gp_name?: string | null;
  gp_address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  group_name?: string | null;
  notes?: string | null;
  avatar_url?: string | null;
  has_allergies?: boolean;
  allergies?: string | null;
  archived?: boolean;
};

export const upsertClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: UpsertInput) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const payload: any = {
      profile_id: profileId,
      full_name: data.full_name.trim(),
    };
    const optional: (keyof UpsertInput)[] = [
      "email","phone","dob","gender","address","address_line1","address_line2","postcode","county",
      "preferred_contact","how_heard","gp_name","gp_address","emergency_contact_name",
      "emergency_contact_phone","group_name","notes","avatar_url","allergies",
    ];
    for (const k of optional) {
      if (k in data) payload[k] = (data as any)[k] || null;
    }
    if ("marketing_opt_in" in data) payload.marketing_opt_in = !!data.marketing_opt_in;
    if ("has_allergies" in data) payload.has_allergies = !!data.has_allergies;
    if ("archived" in data) payload.archived = !!data.archived;

    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("clinic_clients").update(payload).eq("id", data.id).eq("profile_id", profileId)
        .select().single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("clinic_clients").insert(payload).select().single();
    if (error) throw error;
    return row;
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("No profile");
    // Soft delete — move to archive instead of hard delete
    const { error } = await context.supabase
      .from("clinic_clients").update({ archived: true }).eq("id", data.id).eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true, archived: true };
  });

/* ---------- Notes ---------- */
export const listClientNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { client_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_notes").select("*").eq("client_id", data.client_id).order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const upsertClientNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; client_id: string; body: string; visible_to_patient?: boolean; face_map?: any }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const visible = data.visible_to_patient ?? false;
    const faceMap = data.face_map ?? null;
    const hasMarks = !!faceMap && ((faceMap.pins?.length ?? 0) > 0 || (faceMap.strokes?.length ?? 0) > 0);
    if (data.id) {
      const { error } = await context.supabase.from("client_notes")
        .update({ body: data.body, visible_to_patient: visible, shared_at: visible ? new Date().toISOString() : null, face_map: hasMarks ? faceMap : null })
        .eq("id", data.id);
      if (error) throw error;
      return { ok: true };
    }
    const { error } = await context.supabase.from("client_notes")
      .insert({ profile_id: pid, client_id: data.client_id, body: data.body, visible_to_patient: visible, shared_at: visible ? new Date().toISOString() : null, face_map: hasMarks ? faceMap : null });
    if (error) throw error;
    return { ok: true };
  });

export const toggleClientNoteVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; visible: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_notes")
      .update({ visible_to_patient: data.visible, shared_at: data.visible ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });


export const deleteClientNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_notes").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- Files (photos + pdfs) ---------- */
export const listClientFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { client_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_files").select("*").eq("client_id", data.client_id).order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const addClientFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { client_id: string; kind: "photo" | "pdf"; url: string; filename?: string }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { error } = await context.supabase.from("client_files").insert({
      profile_id: pid, client_id: data.client_id, kind: data.kind, url: data.url, filename: data.filename ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

export const deleteClientFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_files").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- Prescriptions ---------- */
export const listClientPrescriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { client_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_prescriptions").select("*").eq("client_id", data.client_id).order("prescribed_on", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const upsertClientPrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string; client_id: string; product: string;
    strength?: string; form?: string; quantity?: string; route?: string;
    dose?: string; directions?: string; prescribed_on?: string; notes?: string;
    prescriber_name?: string; prescriber_reg_number?: string; prescriber_address?: string;
    patient_address_snapshot?: string; patient_dob?: string;
    signature_url?: string; pdf_url?: string; signed_at?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const payload: any = {
      product: data.product,
      strength: data.strength || null,
      form: data.form || null,
      quantity: data.quantity || null,
      route: data.route || null,
      dose: data.dose || null,
      directions: data.directions || null,
      prescribed_on: data.prescribed_on || null,
      notes: data.notes || null,
      prescriber_name: data.prescriber_name || null,
      prescriber_reg_number: data.prescriber_reg_number || null,
      prescriber_address: data.prescriber_address || null,
      patient_address_snapshot: data.patient_address_snapshot || null,
      patient_dob: data.patient_dob || null,
      signature_url: data.signature_url || null,
      pdf_url: data.pdf_url || null,
      signed_at: data.signed_at || null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("client_prescriptions").update(payload).eq("id", data.id);
      if (error) throw error;
      return { ok: true };
    }
    const { data: row, error } = await context.supabase.from("client_prescriptions")
      .insert({ profile_id: pid, client_id: data.client_id, ...payload }).select("id").single();
    if (error) throw error;
    return { ok: true, id: row?.id };
  });


export const deleteClientPrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_prescriptions").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- CSV Import ---------- */
type CsvRow = Record<string, string>;
export const importClientsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rows: CsvRow[] }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, "");
    const pick = (row: CsvRow, keys: string[]) => {
      const map: Record<string, string> = {};
      for (const k of Object.keys(row)) map[norm(k)] = row[k];
      for (const k of keys) {
        const v = map[norm(k)];
        if (v != null && String(v).trim() !== "") return String(v).trim();
      }
      return "";
    };
    const parseDob = (raw: string): string | null => {
      if (!raw) return null;
      const s = raw.trim();
      const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
      if (iso) return `${iso[1]}-${iso[2].padStart(2,"0")}-${iso[3].padStart(2,"0")}`;
      const dmy = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(s);
      if (dmy) {
        let [_, d, m, y] = dmy;
        if (y.length === 2) y = (Number(y) > 30 ? "19" : "20") + y;
        return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
      }
      return null;
    };

    const inserted: string[] = [];
    const updated: string[] = [];
    const skipped: string[] = [];

    for (const row of data.rows) {
      let full_name = pick(row, [
        "full_name", "fullname", "full name",
        "name", "patient", "patient name", "client name", "customer name", "contact name",
        "display name", "displayname",
      ]);
      if (!full_name) {
        const first = pick(row, [
          "first_name", "firstname", "first name", "first",
          "given_name", "given name", "givenname",
          "forename", "fname",
        ]);
        const middle = pick(row, ["middle_name", "middle name", "middlename", "middle"]);
        const last = pick(row, [
          "last_name", "lastname", "last name", "last",
          "surname", "family_name", "family name", "familyname", "lname",
        ]);
        full_name = [first, middle, last].filter(Boolean).join(" ").trim();
      }
      if (!full_name) {
        const title = pick(row, ["title", "salutation"]);
        if (title) full_name = title;
      }
      if (!full_name) { skipped.push(`(missing name) columns: ${Object.keys(row).join(", ")}`); continue; }
      const email = pick(row, ["email", "email address"]).toLowerCase() || null;
      const phone = pick(row, ["phone", "mobile", "telephone", "contact number"]) || null;
      const dob = parseDob(pick(row, ["dob", "date of birth", "birthday", "birth date"]));
      const address = pick(row, ["address", "home address", "street address"]) || null;
      const postcode = pick(row, ["postcode", "postal code", "zip", "zip code"]) || null;
      const city = pick(row, ["city", "town"]) || null;
      const gender = pick(row, ["gender", "sex"]).toLowerCase() || null;
      const notes = pick(row, ["notes", "note", "comments"]) || null;
      const group_name = pick(row, ["group", "group name", "tag"]) || null;

      let existingId: string | null = null;
      if (email) {
        const { data: exist } = await context.supabase
          .from("clinic_clients").select("id").eq("profile_id", pid).ilike("email", email).maybeSingle();
        if (exist?.id) existingId = exist.id;
      }
      const payload: any = { full_name, email, phone, dob, address, postcode, city, gender, notes, group_name };
      Object.keys(payload).forEach((k) => payload[k] == null && delete payload[k]);

      if (existingId) {
        const { error } = await context.supabase.from("clinic_clients").update(payload).eq("id", existingId);
        if (error) { skipped.push(`${full_name}: ${error.message}`); continue; }
        updated.push(existingId);
      } else {
        const { data: row2, error } = await context.supabase
          .from("clinic_clients").insert({ profile_id: pid, ...payload }).select("id").single();
        if (error) { skipped.push(`${full_name}: ${error.message}`); continue; }
        inserted.push(row2.id);
      }
    }
    return { inserted: inserted.length, updated: updated.length, skipped: skipped.length, skippedDetails: skipped.slice(0, 5) };
  });


/* ---------- Groups ---------- */
export const listClientGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) return [];
    const { data } = await context.supabase
      .from("clinic_clients").select("group_name").eq("profile_id", pid).not("group_name", "is", null);
    const counts = new Map<string, number>();
    for (const r of (data ?? []) as { group_name: string | null }[]) {
      const g = (r.group_name ?? "").trim();
      if (!g) continue;
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count })).sort((a,b) => a.name.localeCompare(b.name));
  });

export const assignClientsToGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { client_ids: string[]; group_name: string }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    if (!data.client_ids.length) return { ok: true, count: 0 };
    const { error } = await context.supabase
      .from("clinic_clients").update({ group_name: data.group_name.trim() || null })
      .eq("profile_id", pid).in("id", data.client_ids);
    if (error) throw error;
    return { ok: true, count: data.client_ids.length };
  });

/* ---------- Merge duplicates ---------- */
export const findDuplicateClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) return [];
    const { data } = await context.supabase
      .from("clinic_clients").select("id, full_name, email, phone, created_at").eq("profile_id", pid);
    const rows = (data ?? []) as any[];
    const groups = new Map<string, any[]>();
    for (const r of rows) {
      const keyEmail = r.email ? `e:${String(r.email).toLowerCase().trim()}` : null;
      const keyPhone = r.phone ? `p:${String(r.phone).replace(/\D/g,"")}` : null;
      const keyName = `n:${String(r.full_name || "").toLowerCase().trim()}`;
      const key = keyEmail || keyPhone || keyName;
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return Array.from(groups.entries())
      .filter(([, list]) => list.length > 1)
      .map(([key, list]) => ({ key, clients: list.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) }));
  });

export const mergeClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { keep_id: string; merge_ids: string[] }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const ids = data.merge_ids.filter((x) => x && x !== data.keep_id);
    if (!ids.length) return { ok: true, merged: 0 };

    // Repoint child records to the kept client
    const tables = ["client_notes", "client_files", "client_prescriptions", "appointment_medical_forms", "appointment_consents"] as const;
    const sb: any = context.supabase;
    for (const t of tables) {
      try {
        await sb.from(t).update({ client_id: data.keep_id }).in("client_id", ids);
      } catch { /* table may not have client_id — ignore */ }
    }

    // Backfill kept client from best available field data
    const { data: kept } = await sb.from("clinic_clients").select("*").eq("id", data.keep_id).maybeSingle();
    const { data: others } = await sb.from("clinic_clients").select("*").in("id", ids);
    if (kept && others?.length) {
      const merged: any = {};
      const keptAny: any = kept;
      const fields = ["email","phone","dob","gender","address","address_line1","address_line2","postcode","city","country","county","gp_name","gp_address","emergency_contact_name","emergency_contact_phone","notes","group_name","avatar_url","allergies"];
      for (const f of fields) {
        if (!keptAny[f]) {
          const found = others.find((o: any) => o[f]);
          if (found) merged[f] = found[f];
        }
      }
      if (others.some((o: any) => o.has_allergies)) merged.has_allergies = true;
      if (Object.keys(merged).length) {
        await sb.from("clinic_clients").update(merged).eq("id", data.keep_id);
      }
    }

    const { error } = await context.supabase.from("clinic_clients").delete().eq("profile_id", pid).in("id", ids);
    if (error) throw error;
    return { ok: true, merged: ids.length };
  });
