/**
 * CPF Board FTP Submission File Generation.
 *
 * Fixed-width text format for bulk CPF contribution submission via
 * the CPF Board's electronic filing system (e-Submit@CPF).
 *
 * Format specification:
 *   Header (H):  CSN, company name, submission period (YYYYMM), record count
 *   Detail (D):  Masked NRIC, employee name, OW, AW, employee CPF, employer CPF, total CPF
 *   Trailer (T): Totals for employee CPF, employer CPF, total CPF, SDL
 *
 * All monetary values are integer cents internally; output as dollars with 2 decimal places.
 * NRIC is masked — only last 4 chars stored per PDPA rules.
 */

import { centsToDisplay } from "@/lib/utils/money";

interface CpfSubmissionEmployee {
  nricLast4: string;
  fullName: string;
  owCents: number;
  awCents: number;
  employeeCpfCents: number;
  employerCpfCents: number;
  totalCpfCents: number;
}

interface CpfSubmissionInput {
  csn: string; // CPF Submission Number
  companyName: string;
  period: string; // YYYYMM
  employees: CpfSubmissionEmployee[];
  totalSdlCents: number;
}

interface CpfSubmissionResult {
  filename: string;
  content: string;
}

/** Format cents to fixed-width dollar string (right-aligned, 15 chars): 123456 -> "       1234.56" */
function toFixedWidth(cents: number, width: number = 15): string {
  const dollars = centsToDisplay(cents).replace(/,/g, "");
  return dollars.padStart(width, " ");
}

/** Pad string to fixed width (left-aligned) */
function padRight(str: string, width: number): string {
  return str.slice(0, width).padEnd(width, " ");
}

/**
 * Generate CPF Board FTP submission file.
 *
 * This is the more formal fixed-width format used for bulk submissions
 * via the CPF Board's electronic submission system, as opposed to the
 * simpler EZPay CSV format.
 */
export function generateCpfSubmissionFile(data: CpfSubmissionInput): CpfSubmissionResult {
  const lines: string[] = [];

  // ---------- Header Record ----------
  // H | CSN (15) | Company Name (66) | Period YYYYMM (6) | Record Count (6) |
  const headerLine = [
    "H",
    padRight(data.csn, 15),
    padRight(sanitize(data.companyName), 66),
    padRight(data.period, 6),
    String(data.employees.length).padStart(6, "0"),
  ].join("");
  lines.push(headerLine);

  // ---------- Detail Records ----------
  let totalEmployeeCpfCents = 0;
  let totalEmployerCpfCents = 0;
  let totalCpfCents = 0;

  for (const emp of data.employees) {
    totalEmployeeCpfCents += emp.employeeCpfCents;
    totalEmployerCpfCents += emp.employerCpfCents;
    totalCpfCents += emp.totalCpfCents;

    // D | NRIC (9) | Name (66) | OW (15) | AW (15) | Emp CPF (15) | Er CPF (15) | Total CPF (15)
    const detailLine = [
      "D",
      padRight(`XXXXX${emp.nricLast4}`, 9),
      padRight(sanitize(emp.fullName), 66),
      toFixedWidth(emp.owCents),
      toFixedWidth(emp.awCents),
      toFixedWidth(emp.employeeCpfCents),
      toFixedWidth(emp.employerCpfCents),
      toFixedWidth(emp.totalCpfCents),
    ].join("");
    lines.push(detailLine);
  }

  // ---------- Trailer Record ----------
  // T | Total Emp CPF (15) | Total Er CPF (15) | Total CPF (15) | SDL (15) | Record Count (6)
  const trailerLine = [
    "T",
    toFixedWidth(totalEmployeeCpfCents),
    toFixedWidth(totalEmployerCpfCents),
    toFixedWidth(totalCpfCents),
    toFixedWidth(data.totalSdlCents),
    String(data.employees.length).padStart(6, "0"),
  ].join("");
  lines.push(trailerLine);

  const filename = `CPF_FTP_${data.csn}_${data.period}.txt`;

  return {
    filename,
    content: lines.join("\r\n"),
  };
}

/** Remove characters that could break fixed-width format */
function sanitize(str: string): string {
  return str.replace(/[\r\n]/g, " ").trim();
}
