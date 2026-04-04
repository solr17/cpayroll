/**
 * Self-Help Group (SHG) contribution calculation for Singapore payroll.
 *
 * SHG funds:
 *   CDAC  — Chinese Development Assistance Council
 *   SINDA — Singapore Indian Development Association
 *   MBMF  — Mosque Building and Mendaki Fund
 *   ECF   — Eurasian Community Fund
 *
 * Contributions are wage-band-based and deducted monthly from employee wages.
 * Only Singapore Citizens and Permanent Residents pay SHG; foreigners are exempt
 * (that check is handled in the payroll engine, not here).
 *
 * Rates effective 2024/2025.
 */

export type ShgFundType = "CDAC" | "SINDA" | "MBMF" | "ECF" | "NONE";

export interface ShgResult {
  fundType: ShgFundType;
  contributionCents: number;
}

interface WageBand {
  /** Upper bound in cents (inclusive). Use Infinity for the last band. */
  upperCents: number;
  /** Contribution amount in cents. */
  contributionCents: number;
}

// --- CDAC contribution table ---
// Monthly total wages → contribution
const CDAC_BANDS: WageBand[] = [
  { upperCents: 50_000, contributionCents: 0 },
  { upperCents: 100_000, contributionCents: 50 },
  { upperCents: 200_000, contributionCents: 100 },
  { upperCents: 350_000, contributionCents: 150 },
  { upperCents: 500_000, contributionCents: 300 },
  { upperCents: 750_000, contributionCents: 450 },
  { upperCents: 1_000_000, contributionCents: 600 },
  { upperCents: Infinity, contributionCents: 800 },
];

// --- SINDA contribution table ---
const SINDA_BANDS: WageBand[] = [
  { upperCents: 100_000, contributionCents: 0 },
  { upperCents: 150_000, contributionCents: 100 },
  { upperCents: 250_000, contributionCents: 300 },
  { upperCents: 350_000, contributionCents: 400 },
  { upperCents: 500_000, contributionCents: 550 },
  { upperCents: 750_000, contributionCents: 700 },
  { upperCents: Infinity, contributionCents: 900 },
];

// --- MBMF contribution table ---
const MBMF_BANDS: WageBand[] = [
  { upperCents: 100_000, contributionCents: 0 },
  { upperCents: 200_000, contributionCents: 200 },
  { upperCents: 300_000, contributionCents: 350 },
  { upperCents: 500_000, contributionCents: 500 },
  { upperCents: 750_000, contributionCents: 1_250 },
  { upperCents: 1_000_000, contributionCents: 1_600 },
  { upperCents: Infinity, contributionCents: 2_200 },
];

// --- ECF contribution table ---
const ECF_BANDS: WageBand[] = [
  { upperCents: 50_000, contributionCents: 0 },
  { upperCents: 200_000, contributionCents: 150 },
  { upperCents: 350_000, contributionCents: 300 },
  { upperCents: 500_000, contributionCents: 450 },
  { upperCents: Infinity, contributionCents: 600 },
];

const FUND_BANDS: Record<Exclude<ShgFundType, "NONE">, WageBand[]> = {
  CDAC: CDAC_BANDS,
  SINDA: SINDA_BANDS,
  MBMF: MBMF_BANDS,
  ECF: ECF_BANDS,
};

/**
 * Look up contribution from a wage-band table.
 * Wages are compared as integer cents.
 */
function lookupBand(bands: WageBand[], totalWagesCents: number): number {
  for (const band of bands) {
    if (totalWagesCents <= band.upperCents) {
      return band.contributionCents;
    }
  }
  // Should never reach here since the last band has Infinity upper bound
  return 0;
}

/**
 * Determine the SHG fund type based on employee race and/or religion.
 * Race values follow NRIC classification: "Chinese", "Malay", "Indian", "Eurasian", etc.
 */
export function determineShgFund(race: string | null, religion?: string | null): ShgFundType {
  const normalizedRace = race?.trim().toLowerCase() ?? "";
  const normalizedReligion = religion?.trim().toLowerCase() ?? "";

  if (normalizedRace === "chinese") return "CDAC";
  if (normalizedRace === "indian") return "SINDA";
  if (normalizedRace === "malay" || normalizedReligion === "muslim") return "MBMF";
  if (normalizedRace === "eurasian") return "ECF";

  return "NONE";
}

/**
 * Calculate the SHG contribution for a given fund type and total monthly wages.
 *
 * @param fundType - The SHG fund determined by employee race/religion
 * @param totalWagesCents - Total monthly wages in integer cents
 * @param optedOut - Whether the employee has opted out of SHG contributions
 * @returns ShgResult with fund type and contribution in integer cents
 */
export function calculateShg(
  fundType: ShgFundType,
  totalWagesCents: number,
  optedOut: boolean,
): ShgResult {
  if (optedOut || fundType === "NONE" || totalWagesCents <= 0) {
    return { fundType, contributionCents: 0 };
  }

  const bands = FUND_BANDS[fundType];
  const contributionCents = lookupBand(bands, totalWagesCents);

  return { fundType, contributionCents };
}
