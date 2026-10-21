export type RentalInvoicePaymentMethod = "bank" | "stripe" | "both";

export function rentalInvoiceOptions(method: RentalInvoicePaymentMethod, profile: Record<string, any>, validate = false) {
  const bank = method !== "stripe";
  const stripe = method !== "bank";
  if (validate && bank && !(profile.invoice_iban || (profile.invoice_account_name && profile.invoice_sort_code && profile.invoice_account_number))) {
    throw new Error("Save your bank transfer details in Invoice details first");
  }
  if (validate && stripe && !profile.stripe_connect_account_id) {
    throw new Error("Connect Stripe in Payments before sending a Stripe invoice");
  }
  return { bank, stripe };
}