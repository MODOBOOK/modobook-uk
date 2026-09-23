// Splits one combined online payment across several appointments in
// proportion to each appointment's price (e.g. £20 + £400 paid together
// becomes £20 and £400, not £210 each). Falls back to an even split when
// prices are unknown.
export async function splitPaymentCents(
  supabaseAdmin: any,
  ids: string[],
  totalCents: number,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const total = Math.max(0, Math.round(totalCents));
  let weights = ids.map(() => 1);
  try {
    const { data } = await supabaseAdmin
      .from("appointments")
      .select("id,total_amount")
      .in("id", ids);
    const priceById = new Map<string, number>(
      (data ?? []).map((r: { id: string; total_amount: unknown }) => [
        r.id,
        Math.max(0, Number(r.total_amount) || 0),
      ]),
    );
    const w = ids.map((id) => priceById.get(id) ?? 0);
    if (w.reduce((s, x) => s + x, 0) > 0) weights = w;
  } catch {
    // keep even split
  }
  const sum = weights.reduce((s, x) => s + x, 0);
  let allocated = 0;
  ids.forEach((id, i) => {
    const share =
      i === ids.length - 1 ? total - allocated : Math.round((total * weights[i]) / sum);
    allocated += share;
    out.set(id, share);
  });
  return out;
}
