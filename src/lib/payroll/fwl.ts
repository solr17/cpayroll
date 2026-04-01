/**
 * Foreign Worker Levy (FWL) Calculation
 *
 * Applies only to Work Permit and S Pass holders.
 * Employer-borne cost — NOT deducted from employee salary.
 * Rate is configurable per worker (stored in employee record).
 */

import type { FwlResult } from "./types";
import type { CitizenshipStatus } from "@/types";

export function calculateFwl(
  citizenshipStatus: CitizenshipStatus,
  fwlRateCents: number,
): FwlResult {
  // Only foreign workers have FWL
  if (citizenshipStatus !== "FW") {
    return { fwlCents: 0 };
  }

  return { fwlCents: fwlRateCents };
}
