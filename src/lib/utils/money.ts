/**
 * Integer cents arithmetic for financial calculations.
 * ALL monetary values in the system are integer cents.
 * No floating point for money. Ever.
 */

/** Format integer cents to display string: 123456 → "1,234.56" */
export function centsToDisplay(cents: number): string {
  const dollars = Math.floor(Math.abs(cents) / 100);
  const remainingCents = Math.abs(cents) % 100;
  const sign = cents < 0 ? "-" : "";
  const formatted = dollars.toLocaleString("en-SG");
  return `${sign}${formatted}.${String(remainingCents).padStart(2, "0")}`;
}

/** Format integer cents to dollar string with S$ prefix: 123456 → "S$1,234.56" */
export function centsToCurrency(cents: number): string {
  return `S$${centsToDisplay(cents)}`;
}

/** Parse display string to integer cents: "1,234.56" → 123456 */
export function displayToCents(display: string): number {
  const cleaned = display.replace(/[^0-9.-]/g, "");
  const parts = cleaned.split(".");
  const dollars = parseInt(parts[0] ?? "0", 10);
  const cents = parseInt((parts[1] ?? "0").padEnd(2, "0").slice(0, 2), 10);
  const sign = cleaned.startsWith("-") ? -1 : 1;
  return sign * (Math.abs(dollars) * 100 + cents);
}

/**
 * Multiply cents by a rate (decimal).
 * This is the ONE place floating-point enters — the rounding mode is explicit.
 *
 * For CPF:
 *   totalCpf: use 'round' (>= 0.50 up, < 0.50 down)
 *   employeeShare: use 'floor' (always round DOWN)
 *   employerShare: NEVER call this — derive as totalCpf - employeeShare
 */
export function multiplyByRate(
  cents: number,
  rate: number,
  roundingMode: "floor" | "ceil" | "round",
): number {
  const result = cents * rate;
  switch (roundingMode) {
    case "floor":
      return Math.floor(result);
    case "ceil":
      return Math.ceil(result);
    case "round":
      return Math.round(result);
  }
}

/** Add multiple cent values safely */
export function addCents(...values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0);
}

/** Subtract cents: a - b */
export function subtractCents(a: number, b: number): number {
  return a - b;
}

/** Pro-rate cents by calendar days: (cents * daysWorked) / totalDays, rounded down */
export function prorateCents(cents: number, daysWorked: number, totalDays: number): number {
  return Math.floor((cents * daysWorked) / totalDays);
}

/** Calculate overtime hourly rate per MOM: (basicSalaryCents / (26 * 8)) * multiplier */
export function overtimeHourlyRateCents(basicSalaryCents: number, multiplier: number): number {
  return Math.round((basicSalaryCents / (26 * 8)) * multiplier);
}
