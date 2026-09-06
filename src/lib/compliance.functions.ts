// Checks & audits (clinic compliance). Clinic-scoped: owner + staff can record,
// only the owner can sign an audit off.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AUDIT_PRESETS,
  CHECK_PRESETS,
  addDays,
  frequencyDays,
  todayIso,
} from "./compliance-presets";

type Ctx = { supabase: any; userId: string; claims?: any };

async function access(context: Ctx) {
  const { resolveClinicAccess } = await import("./clinic-context.server");
  const a = await resolveClinicAccess(context.supabase, context.userId);
  if (!a.profileId) throw new Error("No clinic found for your account.");
  return { ...a, profileId: a.profileId as string };
}

async function actorName(context: Ctx, profileId: string) {
  const db = context.supabase as any;
  const { data: staff } = await db
    .from("staff_members")
    .select("name")
    .eq("user_id", context.userId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (staff?.name) return staff.name as string;
  const { data: p } = await db
    .from("profiles")
    .select("full_name, clinic_name")
    .eq("id", profileId)
    .maybeSingle();
  return (p?.full_name || p?.clinic_name || context.claims?.email || "Clinic team") as string;
}

function nextDue(frequency: string, from: string) {
  const days = frequencyDays(frequency);
  return days > 0 ? addDays(from, days) : null;
}

// ---- Overview -------------------------------------------------------------

/**
 * Insert any ready-made checks/audits the clinic doesn't already have.
 * Shared by the automatic first-load seed and the manual button.
 */
async function seedPresets(db: any, profileId: string, checkKeys?: string[], auditKeys?: string[]) {
  const today = todayIso();
  const wantChecks = CHECK_PRESETS.filter((p) => !checkKeys || checkKeys.includes(p.key));
  const wantAudits = AUDIT_PRESETS.filter((p) => !auditKeys || auditKeys.includes(p.key));

  const [{ data: existingChecks }, { data: existingAudits }] = await Promise.all([
    db.from("compliance_check_templates").select("name").eq("profile_id", profileId),
    db.from("compliance_audit_templates").select("name").eq("profile_id", profileId),
  ]);
  const haveCheck = new Set((existingChecks ?? []).map((r: any) => r.name));
  const haveAudit = new Set((existingAudits ?? []).map((r: any) => r.name));

  const checkRows = wantChecks
    .filter((p) => !haveCheck.has(p.name))
    .map((p, i) => ({
      profile_id: profileId,
      name: p.name,
      kind: p.kind,
      description: p.description,
      frequency: p.frequency,
      fields: p.fields,
      next_due_on: today,
      sort_order: i,
      remind_email: true,
      remind_in_app: true,
      active: true,
    }));
  const auditRows = wantAudits
    .filter((p) => !haveAudit.has(p.name))
    .map((p) => ({
      profile_id: profileId,
      name: p.name,
      description: p.description,
      category: p.category,
      questions: p.questions,
      frequency: p.frequency,
      next_due_on: nextDue(p.frequency, today) ?? today,
      remind_email: true,
      remind_in_app: true,
      active: true,
    }));

  if (checkRows.length) {
    const { error } = await db.from("compliance_check_templates").insert(checkRows);
    if (error) throw error;
  }
  if (auditRows.length) {
    const { error } = await db.from("compliance_audit_templates").insert(auditRows);
    if (error) throw error;
  }
  return { checks: checkRows.length, audits: auditRows.length };
}

export const getCompliance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const a = await access(context as Ctx);

    // First visit: give the clinic the full ready-made set, already scheduled
    // with reminders, so audits open pre-filled with their questions.
    const { count: tplCount } = await db
      .from("compliance_check_templates")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", a.profileId);
    const { count: audCount } = await db
      .from("compliance_audit_templates")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", a.profileId);
    if (!tplCount && !audCount) {
      try {
        await seedPresets(db, a.profileId);
      } catch {
        /* non-fatal — the page still loads and the button can retry */
      }
    }

    const [checks, audits, records, auditRuns, actions] = await Promise.all([

      db.from("compliance_check_templates").select("*").eq("profile_id", a.profileId).order("sort_order").order("name"),
      db.from("compliance_audit_templates").select("*").eq("profile_id", a.profileId).order("name"),
      db
        .from("compliance_check_records")
        .select("*")
        .eq("profile_id", a.profileId)
        .order("performed_on", { ascending: false })
        .limit(200),
      db
        .from("compliance_audits")
        .select("*")
        .eq("profile_id", a.profileId)
        .order("conducted_on", { ascending: false })
        .limit(100),
      db
        .from("compliance_actions")
        .select("*")
        .eq("profile_id", a.profileId)
        .order("due_on", { ascending: true })
        .limit(300),
    ]);

    return {
      isOwner: a.isOwner,
      role: a.role,
      checkTemplates: checks.data ?? [],
      auditTemplates: audits.data ?? [],
      records: records.data ?? [],
      audits: auditRuns.data ?? [],
      actions: actions.data ?? [],
      today: todayIso(),
    };
  });

// ---- Seeding ready-made templates ----------------------------------------

export const seedComplianceDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { checkKeys?: string[]; auditKeys?: string[] }) => i)
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const a = await access(context as Ctx);
    return await seedPresets(db, a.profileId, data.checkKeys, data.auditKeys);
  });

    return { checks: checkRows.length, audits: auditRows.length };
  });

// ---- Check templates ------------------------------------------------------

export const saveCheckTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      id?: string;
      name: string;
      kind: string;
      description?: string | null;
      frequency: string;
      fields: unknown[];
      next_due_on?: string | null;
      remind_email?: boolean;
      remind_in_app?: boolean;
      active?: boolean;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const a = await access(context as Ctx);
    if (!data.name?.trim()) throw new Error("Give the check a name.");
    const row = {
      profile_id: a.profileId,
      name: data.name.trim(),
      kind: data.kind || "custom",
      description: data.description?.trim() || null,
      frequency: data.frequency,
      fields: data.fields ?? [],
      next_due_on: data.next_due_on || todayIso(),
      remind_email: data.remind_email ?? true,
      remind_in_app: data.remind_in_app ?? true,
      active: data.active ?? true,
    };
    const q = data.id
      ? db.from("compliance_check_templates").update(row).eq("id", data.id).eq("profile_id", a.profileId)
      : db.from("compliance_check_templates").insert(row);
    const { data: saved, error } = await q.select("*").single();
    if (error) throw error;
    return saved;
  });

export const deleteCheckTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const a = await access(context as Ctx);
    const { error } = await db
      .from("compliance_check_templates")
      .delete()
      .eq("id", data.id)
      .eq("profile_id", a.profileId);
    if (error) throw error;
    return { ok: true };
  });

// ---- Recording a check ----------------------------------------------------

export const recordCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      template_id: string;
      values: Record<string, unknown>;
      issue_flagged?: boolean;
      notes?: string | null;
      performed_on?: string;
      action?: { description: string; owner_name?: string | null; due_on?: string | null } | null;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const a = await access(context as Ctx);
    const { data: tpl, error: tErr } = await db
      .from("compliance_check_templates")
      .select("*")
      .eq("id", data.template_id)
      .eq("profile_id", a.profileId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!tpl) throw new Error("Check not found.");

    const performedOn = data.performed_on || todayIso();
    const name = await actorName(context as Ctx, a.profileId!);

    const { data: record, error } = await db
      .from("compliance_check_records")
      .insert({
        profile_id: a.profileId,
        template_id: tpl.id,
        template_name: tpl.name,
        due_on: tpl.next_due_on,
        performed_on: performedOn,
        performed_by_user_id: context.userId,
        performed_by_name: name,
        values: data.values ?? {},
        issue_flagged: data.issue_flagged ?? false,
        notes: data.notes?.trim() || null,
      })
      .select("*")
      .single();
    if (error) throw error;

    await db
      .from("compliance_check_templates")
      .update({ next_due_on: nextDue(tpl.frequency, performedOn) })
      .eq("id", tpl.id)
      .eq("profile_id", a.profileId);

    if (data.action?.description?.trim()) {
      await db.from("compliance_actions").insert({
        profile_id: a.profileId,
        check_record_id: record.id,
        description: data.action.description.trim(),
        owner_name: data.action.owner_name?.trim() || name,
        due_on: data.action.due_on || null,
      });
    }
    return record;
  });

// ---- Audit templates ------------------------------------------------------

export const saveAuditTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      id?: string;
      name: string;
      description?: string | null;
      category?: string | null;
      frequency: string;
      questions: Array<{ id: string; section: string; text: string }>;
      next_due_on?: string | null;
      remind_email?: boolean;
      remind_in_app?: boolean;
      active?: boolean;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const a = await access(context as Ctx);
    if (!data.name?.trim()) throw new Error("Give the audit a name.");
    const row = {
      profile_id: a.profileId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      category: data.category?.trim() || null,
      frequency: data.frequency,
      questions: data.questions ?? [],
      next_due_on: data.next_due_on || nextDue(data.frequency, todayIso()),
      remind_email: data.remind_email ?? true,
      remind_in_app: data.remind_in_app ?? true,
      active: data.active ?? true,
    };
    const q = data.id
      ? db.from("compliance_audit_templates").update(row).eq("id", data.id).eq("profile_id", a.profileId)
      : db.from("compliance_audit_templates").insert(row);
    const { data: saved, error } = await q.select("*").single();
    if (error) throw error;
    return saved;
  });

export const deleteAuditTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const a = await access(context as Ctx);
    const { error } = await db
      .from("compliance_audit_templates")
      .delete()
      .eq("id", data.id)
      .eq("profile_id", a.profileId);
    if (error) throw error;
    return { ok: true };
  });

// ---- Running an audit -----------------------------------------------------

function scoreOf(answers: Record<string, { result?: string }>, questions: Array<{ id: string }>) {
  let scored = 0;
  let met = 0;
  for (const q of questions) {
    const r = answers?.[q.id]?.result;
    if (r === "na" || !r) continue;
    scored += 1;
    if (r === "yes") met += 1;
  }
  return scored ? Math.round((met / scored) * 1000) / 10 : null;
}

export const saveAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      id?: string;
      template_id?: string | null;
      name: string;
      conducted_on?: string;
      questions: Array<{ id: string; section: string; text: string }>;
      answers: Record<string, { result?: string; comment?: string }>;
      summary?: string | null;
      complete?: boolean;
      actions?: Array<{ description: string; owner_name?: string | null; due_on?: string | null }>;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const a = await access(context as Ctx);
    const name = await actorName(context as Ctx, a.profileId!);
    const conductedOn = data.conducted_on || todayIso();
    const row = {
      profile_id: a.profileId,
      template_id: data.template_id || null,
      name: data.name?.trim() || "Audit",
      conducted_on: conductedOn,
      conducted_by_user_id: context.userId,
      conducted_by_name: name,
      questions: data.questions ?? [],
      answers: data.answers ?? {},
      score_percent: scoreOf(data.answers ?? {}, data.questions ?? []),
      summary: data.summary?.trim() || null,
      status: data.complete ? "completed" : "in_progress",
    };
    const q = data.id
      ? db.from("compliance_audits").update(row).eq("id", data.id).eq("profile_id", a.profileId)
      : db.from("compliance_audits").insert(row);
    const { data: saved, error } = await q.select("*").single();
    if (error) throw error;

    for (const act of data.actions ?? []) {
      if (!act.description?.trim()) continue;
      await db.from("compliance_actions").insert({
        profile_id: a.profileId,
        audit_id: saved.id,
        description: act.description.trim(),
        owner_name: act.owner_name?.trim() || name,
        due_on: act.due_on || null,
      });
    }

    if (data.complete && data.template_id) {
      const { data: tpl } = await db
        .from("compliance_audit_templates")
        .select("frequency")
        .eq("id", data.template_id)
        .maybeSingle();
      if (tpl) {
        await db
          .from("compliance_audit_templates")
          .update({ next_due_on: nextDue(tpl.frequency, conductedOn) })
          .eq("id", data.template_id)
          .eq("profile_id", a.profileId);
      }
    }
    return saved;
  });

export const signOffAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const a = await access(context as Ctx);
    if (!a.isOwner && a.role !== "admin") {
      throw new Error("Only the clinic owner can sign an audit off.");
    }
    const name = await actorName(context as Ctx, a.profileId!);
    const { data: saved, error } = await db
      .from("compliance_audits")
      .update({
        status: "signed_off",
        signed_off_by_user_id: context.userId,
        signed_off_by_name: name,
        signed_off_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("profile_id", a.profileId)
      .select("*")
      .single();
    if (error) throw error;
    return saved;
  });

export const deleteAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const a = await access(context as Ctx);
    const { error } = await db
      .from("compliance_audits")
      .delete()
      .eq("id", data.id)
      .eq("profile_id", a.profileId);
    if (error) throw error;
    return { ok: true };
  });

// ---- Action plan ----------------------------------------------------------

export const saveAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      id?: string;
      audit_id?: string | null;
      description: string;
      owner_name?: string | null;
      due_on?: string | null;
      status?: string;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const a = await access(context as Ctx);
    if (!data.description?.trim()) throw new Error("Describe the action.");
    const row: Record<string, unknown> = {
      profile_id: a.profileId,
      audit_id: data.audit_id || null,
      description: data.description.trim(),
      owner_name: data.owner_name?.trim() || null,
      due_on: data.due_on || null,
      status: data.status || "open",
      completed_at: data.status === "done" ? new Date().toISOString() : null,
    };
    const q = data.id
      ? db.from("compliance_actions").update(row).eq("id", data.id).eq("profile_id", a.profileId)
      : db.from("compliance_actions").insert(row);
    const { data: saved, error } = await q.select("*").single();
    if (error) throw error;
    return saved;
  });

export const deleteAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const a = await access(context as Ctx);
    const { error } = await db
      .from("compliance_actions")
      .delete()
      .eq("id", data.id)
      .eq("profile_id", a.profileId);
    if (error) throw error;
    return { ok: true };
  });
