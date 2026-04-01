/**
 * CPF Calculation Module — CENTRALISED. No CPF math anywhere else.
 *
 * Rounding rules (from CPF Board):
 *   1. Total CPF = Math.round(wages * totalRate) — nearest dollar, >= 0.50 up
 *   2. Employee share = Math.floor(wages * employeeRate) — always rounds DOWN
 *   3. Employer share = Total - Employee — DERIVED, never independent
 *
 * All values in integer cents.
 */

import type { CpfCalculationInput, CpfCalculationResult, CpfRateEntry } from "./types";
import { CPF_CEILINGS_2026 } from "@/types";

const OW_MONTHLY_CEILING_CENTS = CPF_CEILINGS_2026.owMonthlyCents;
const ANNUAL_SALARY_CEILING_CENTS = CPF_CEILINGS_2026.annualSalaryCeilingCents;
const ANNUAL_CPF_LIMIT_CENTS = CPF_CEILINGS_2026.annualCpfLimitCents;

/** Find the matching rate entry for an employee's age */
export function findRateForAge(rates: CpfRateEntry[], age: number): CpfRateEntry | null {
  return rates.find((r) => age >= r.ageBandMin && age <= r.ageBandMax) ?? null;
}

/** Get age band label from age */
export function getAgeBandLabel(age: number): string {
  if (age <= 55) return "55 and below";
  if (age <= 60) return "Above 55 to 60";
  if (age <= 65) return "Above 60 to 65";
  if (age <= 70) return "Above 65 to 70";
  return "Above 70";
}

/** Cap OW at monthly ceiling */
export function capOw(owCents: number): number {
  return Math.min(owCents, OW_MONTHLY_CEILING_CENTS);
}

/** Calculate AW ceiling: $102,000 - total OW for the year */
export function getAwCeiling(ytdOwCents: number): number {
  return Math.max(0, ANNUAL_SALARY_CEILING_CENTS - ytdOwCents);
}

/** Cap AW at AW ceiling */
export function capAw(awCents: number, ytdOwCents: number): number {
  const ceiling = getAwCeiling(ytdOwCents);
  return Math.min(awCents, ceiling);
}

/**
 * Compute CPF on a wage component.
 * Returns { total, employee, employer } all in cents.
 */
function computeCpfOnWage(
  wageCents: number,
  rate: CpfRateEntry,
): { totalCents: number; employeeCents: number; employerCents: number } {
  if (wageCents <= 0) {
    return { totalCents: 0, employeeCents: 0, employerCents: 0 };
  }

  // Step 1: Total CPF = round to nearest dollar (>= 0.50 up)
  const totalCents = Math.round(wageCents * rate.totalRate);

  // Step 2: Employee share = always round DOWN
  const employeeCents = Math.floor(wageCents * rate.employeeRate);

  // Step 3: Employer share = Total - Employee (DERIVED)
  const employerCents = totalCents - employeeCents;

  return { totalCents, employeeCents, employerCents };
}

/**
 * Main CPF calculation.
 * Handles OW/AW capping, age band lookup, annual limit check.
 */
export function calculateCpf(input: CpfCalculationInput): CpfCalculationResult {
  const { owCents, awCents, age, citizenshipStatus, ytdOwCents, ytdCpfCents, rates } = input;

  // Foreigners: no CPF
  if (citizenshipStatus === "FW") {
    return {
      owCappedCents: owCents,
      awCappedCents: awCents,
      employerCpfCents: 0,
      employeeCpfCents: 0,
      totalCpfCents: 0,
      ageBand: getAgeBandLabel(age),
      employerRate: 0,
      employeeRate: 0,
      totalRate: 0,
    };
  }

  // Find rate for age band
  const rate = findRateForAge(rates, age);
  if (!rate) {
    throw new Error(`No CPF rate found for age ${age}`);
  }

  // Cap OW at monthly ceiling
  const owCappedCents = capOw(owCents);

  // Cap AW at AW ceiling (considering YTD OW including this month)
  const totalYtdOw = ytdOwCents + owCappedCents;
  const awCappedCents = capAw(awCents, totalYtdOw);

  // Compute CPF on OW
  const owCpf = computeCpfOnWage(owCappedCents, rate);

  // Compute CPF on AW
  const awCpf = computeCpfOnWage(awCappedCents, rate);

  // Sum OW + AW contributions
  let totalCpfCents = owCpf.totalCents + awCpf.totalCents;
  let employeeCpfCents = owCpf.employeeCents + awCpf.employeeCents;
  let employerCpfCents = owCpf.employerCents + awCpf.employerCents;

  // Check annual CPF limit ($37,740)
  const projectedYtdCpf = ytdCpfCents + totalCpfCents;
  if (projectedYtdCpf > ANNUAL_CPF_LIMIT_CENTS) {
    const allowable = Math.max(0, ANNUAL_CPF_LIMIT_CENTS - ytdCpfCents);
    if (allowable <= 0) {
      totalCpfCents = 0;
      employeeCpfCents = 0;
      employerCpfCents = 0;
    } else {
      // Scale down proportionally
      const ratio = allowable / totalCpfCents;
      employeeCpfCents = Math.floor(employeeCpfCents * ratio);
      totalCpfCents = allowable;
      employerCpfCents = totalCpfCents - employeeCpfCents;
    }
  }

  return {
    owCappedCents,
    awCappedCents,
    employerCpfCents,
    employeeCpfCents,
    totalCpfCents,
    ageBand: getAgeBandLabel(age),
    employerRate: rate.employerRate,
    employeeRate: rate.employeeRate,
    totalRate: rate.totalRate,
  };
}

/**
 * For low wages ($50-$500): employer only contributes.
 * For wages $500-$750: employee contribution is graduated.
 * This adjusts the standard calculation for low-wage employees.
 */
export function adjustForLowWage(
  wageCents: number,
  result: CpfCalculationResult,
): CpfCalculationResult {
  // Below $50: no CPF
  if (wageCents < 5000) {
    return { ...result, employerCpfCents: 0, employeeCpfCents: 0, totalCpfCents: 0 };
  }

  // $50-$500: employer only, no employee deduction
  if (wageCents >= 5000 && wageCents <= 50000) {
    const employerOnly = result.employerCpfCents + result.employeeCpfCents;
    return {
      ...result,
      employerCpfCents: employerOnly,
      employeeCpfCents: 0,
      totalCpfCents: employerOnly,
    };
  }

  // $500-$750: graduated employee contribution
  if (wageCents > 50000 && wageCents <= 75000) {
    // Graduated formula: 0.6 * (Total Wages - $500)
    const graduatedEmployee = Math.floor(0.6 * (wageCents - 50000));
    const total = result.totalCpfCents;
    const employer = total - graduatedEmployee;
    return { ...result, employerCpfCents: employer, employeeCpfCents: graduatedEmployee };
  }

  // Above $750: standard rates apply
  return result;
}
