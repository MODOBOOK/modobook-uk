export type ServicePaymentRequirement = "clinic" | "deposit" | "full";

export type ServicePaymentLine = {
  amountCents: number;
  requirement?: string | null;
  depositAmount?: number | null;
  defaultBaseCents?: number;
};

export type ClinicDepositSettings = {
  enabled: boolean;
  fixedCents: number;
  percent: number;
  type: "fixed" | "percent";
  perBooking: boolean;
};

export function servicePaymentRequirement(value: unknown, depositAmount?: number | null): ServicePaymentRequirement {
  if (value === "full" || value === "deposit") return value;
  // Existing custom deposits keep working after the additive schema change.
  return depositAmount != null ? "deposit" : "clinic";
}

export function hasServicePaymentOverride(lines: ServicePaymentLine[]): boolean {
  return lines.some((line) => servicePaymentRequirement(line.requirement, line.depositAmount) !== "clinic");
}

export function servicePaymentDueCents(lines: ServicePaymentLine[], settings: ClinicDepositSettings): number {
  let due = 0;
  const defaults: ServicePaymentLine[] = [];
  for (const line of lines) {
    const amount = Math.max(0, Math.round(line.amountCents));
    const requirement = servicePaymentRequirement(line.requirement, line.depositAmount);
    if (requirement === "full") due += amount;
    else if (requirement === "deposit") due += Math.min(amount, Math.max(0, Math.round(Number(line.depositAmount ?? 0) * 100)));
    else defaults.push(line);
  }
  if (settings.enabled && defaults.length) {
    const defaultDeposit = (line: ServicePaymentLine) => settings.type === "percent"
      ? Math.round(Math.max(0, line.defaultBaseCents ?? line.amountCents) * Math.max(0, Math.min(100, settings.percent)) / 100)
      : Math.max(0, settings.fixedCents);
    if (settings.perBooking) {
      const total = defaults.reduce((sum, line) => sum + Math.max(0, line.amountCents), 0);
      const deposit = settings.type === "percent"
        ? defaults.reduce((sum, line) => sum + defaultDeposit(line), 0)
        : Math.max(0, settings.fixedCents);
      due += Math.min(total, deposit);
    } else {
      due += defaults.reduce((sum, line) => sum + Math.min(Math.max(0, line.amountCents), defaultDeposit(line)), 0);
    }
  }
  return Math.min(lines.reduce((sum, line) => sum + Math.max(0, line.amountCents), 0), Math.max(0, Math.round(due)));
}

export function enforceServicePaymentChoice<T extends { mode: string; method: string }>(
  choice: T | null,
  lines: ServicePaymentLine[],
  settings: ClinicDepositSettings,
): T | { mode: "deposit"; method: "card" } | null {
  if (hasServicePaymentOverride(lines) && servicePaymentDueCents(lines, settings) > 0 && choice?.mode !== "full") {
    return { mode: "deposit", method: "card" };
  }
  return choice;
}