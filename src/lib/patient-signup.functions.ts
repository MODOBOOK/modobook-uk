import { createServerFn } from "@tanstack/react-start";

// Patients signing up on a booking link are created already confirmed, like
// practitioners, so their password works straight away.
export const createConfirmedPatient = createServerFn({ method: "POST" })
  .inputValidator((i: { email: string; password: string; fullName?: string; phone?: string }) => {
    const email = String(i.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please enter a valid email address.");
    if (typeof i.password !== "string" || i.password.length < 6) throw new Error("Password must be at least 6 characters.");
    return { email, password: i.password, fullName: String(i.fullName ?? "").slice(0, 200), phone: String(i.phone ?? "").slice(0, 50) };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone },
    });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) return { existing: true };
      throw new Error(error.message);
    }
    return { existing: false };
  });
