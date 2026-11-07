type LocationCategory = {
  id: string;
  parent_id?: string | null;
  allowed_location_ids?: string[] | null;
};

/** Category restrictions also apply to child categories and their offers. */
export function categoryMatchesLocation(
  categoryId: string | null | undefined,
  locationId: string | null,
  categories: LocationCategory[],
): boolean {
  const visited = new Set<string>();
  let id = categoryId;
  while (id && !visited.has(id)) {
    visited.add(id);
    const category = categories.find((item) => item.id === id);
    if (!category) return true;
    if (category.allowed_location_ids &&
      (!locationId || !category.allowed_location_ids.includes(locationId))) return false;
    id = category.parent_id;
  }
  return true;
}