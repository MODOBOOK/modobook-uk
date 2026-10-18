/** Unassigned model slots are shared; assigned slots require their selected location. */
export function modelSlotMatchesLocation(
  slotLocationId: string | null,
  selectedLocationId: string | null,
): boolean {
  return slotLocationId === null || slotLocationId === selectedLocationId;
}