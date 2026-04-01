/**
 * Skills Development Levy (SDL) Calculation
 *
 * Rate: 0.25% of total monthly remuneration
 * Floor: $2 per employee per month (wages < $800)
 * Ceiling: $11.25 per employee per month (wages > $4,500)
 * Applies to ALL employees: SC, PR, and foreigners.
 */

import type { SdlResult } from "./types";
import { SDL } from "@/types";

export function calculateSdl(totalRemunerationCents: number): SdlResult {
  if (totalRemunerationCents <= 0) {
    return { sdlCents: 0 };
  }

  const rawSdl = Math.round(totalRemunerationCents * SDL.rate);
  const sdlCents = Math.max(SDL.floorCents, Math.min(SDL.ceilingCents, rawSdl));

  return { sdlCents };
}
