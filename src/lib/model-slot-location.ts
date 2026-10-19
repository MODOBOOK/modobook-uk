/** Unassigned model slots are shared; assigned slots require their selected location. */
export function modelSlotMatchesLocation(
  slotLocationId: string | null,
  selectedLocationId: string | null,
): boolean {
  return slotLocationId === null || slotLocationId === selectedLocationId;
}

/**
 * Once a patient picks a practitioner, only that practitioner's model slots
 * (and slots with nobody set) are shown. No pick = every slot shows.
 */
export function modelSlotMatchesPractitioner(
  slotPractitionerId: string | null | undefined,
  chosenPractitionerId: string | null | undefined,
): boolean {
  if (!chosenPractitionerId || !slotPractitionerId) return true;
  return slotPractitionerId === chosenPractitionerId;
}
