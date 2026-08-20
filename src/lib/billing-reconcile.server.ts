/**
 * Self-healing subscription reconciliation.
 *
 * Stripe webhooks can be missed (delivery failure, endpoint reconfigured, a
 * checkout completed against a customer we never stored). When that happens a
 * practitioner who *has* paid stays locked out. This looks the practitioner up
 * in Stripe directly — by stored customer id, by profile metadata, then by
 * email — and mirrors any live subscription back into the database.
 *
 * Cheap and safe to call whenever an account looks locked.
 */
const LIVE_STATUSES = ["active", "trialing", "past_due", "unpaid", "incomplete"];

export async function reconcileSubscriptionFromStripe(
  supabase: any,
  profileId: string,
  email?: string | null,
): Promise<boolean> {
  try {
    const { getStripe } = await import("./stripe.server");
    const stripe = getStripe();

    const { data: row } = await supabase
      .from("practitioner_subscriptions")
      .select("id, stripe_customer_id, stripe_subscription_id, status")
      .eq("profile_id", profileId)
      .maybeSingle();

    const customerIds = new Set<string>();
    if (row?.stripe_customer_id) customerIds.add(row.stripe_customer_id);

    if (customerIds.size === 0 || !row?.stripe_subscription_id) {
      // Search Stripe for customers we created for this profile.
      try {
        const found = await stripe.customers.search({
          query: `metadata['profile_id']:'${profileId}'`,
          limit: 10,
        });
        for (const c of found.data) customerIds.add(c.id);
      } catch {
        // search unavailable — fall through to email lookup
      }
      if (email) {
        try {
          const byEmail = await stripe.customers.list({ email, limit: 10 });
          for (const c of byEmail.data) customerIds.add(c.id);
        } catch {
          /* ignore */
        }
      }
    }

    for (const customerId of customerIds) {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
      const live = subs.data.find((s) => LIVE_STATUSES.includes(s.status));
      if (!live) continue;

      const patch = {
        stripe_customer_id: customerId,
        stripe_subscription_id: live.id,
        status: live.status,
        cancel_at_period_end: live.cancel_at_period_end,
        current_period_end: (live as any).current_period_end
          ? new Date((live as any).current_period_end * 1000).toISOString()
          : null,
        trial_end: live.trial_end ? new Date(live.trial_end * 1000).toISOString() : null,
        stripe_addon_items: live.items.data.map((item) => ({
          id: item.id,
          price: item.price?.id,
          quantity: item.quantity,
        })),
      };

      if (row?.id) {
        await supabase.from("practitioner_subscriptions").update(patch as never).eq("id", row.id);
      } else {
        await supabase
          .from("practitioner_subscriptions")
          .insert({ profile_id: profileId, ...patch } as never);
      }
      return true;
    }
  } catch (e) {
    console.error("[billing-reconcile] failed", e);
  }
  return false;
}
