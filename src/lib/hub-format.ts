export function formatHubCode(raw: string | null | undefined): string {
  if (!raw) return "—";
  const code = raw.toUpperCase();
  if (code.startsWith("PR") && code.length >= 3) {
    return `PR-${code.slice(2)}`;
  }
  if (code.startsWith("RX") && code.length >= 3) {
    return `RX-${code.slice(2)}`;
  }
  return `MODO-${code}`;
}
