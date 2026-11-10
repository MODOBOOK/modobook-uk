/** WhatsApp requires international digits only; national numbers default to UK. */
export function whatsappLink(phone?: string | null, message?: string): string | null {
  const raw = phone?.trim();
  if (!raw || !/^\+?[\d\s().-]+$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0") && !raw.startsWith("+")) digits = `44${digits.slice(1)}`;
  // Accept the common UK international notation +44 (0)7… too.
  if (digits.startsWith("440")) digits = `44${digits.slice(3)}`;
  if (!/^[1-9]\d{6,14}$/.test(digits)) return null;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}