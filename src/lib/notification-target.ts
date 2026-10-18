// Where tapping a notification should go. Booking notifications open the
// booking itself in the diary.
type N = { entity_type?: string | null; entity_id?: string | null; link?: string | null; resolved_link?: string | null };

export function openNotification(n: N, navigate: (o: any) => unknown) {
  if (n.entity_type === "appointment" && n.entity_id) {
    navigate({ to: "/dashboard/bookings", search: { appt: n.entity_id } });
    return;
  }
  const target = n.resolved_link || n.link;
  if (target) navigate({ to: target });
}
