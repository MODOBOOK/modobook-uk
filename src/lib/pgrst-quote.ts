/** Quote a value for safe use inside a PostgREST `.or()` filter string. */
export function pgq(v: string): string {
  return `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
