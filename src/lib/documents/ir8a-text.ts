/**
 * IRAS AIS (Auto-Inclusion Scheme) Text File Generation.
 * Pipe-delimited text format for IR8A submission to IRAS.
 *
 * Format:
 *   Header record:  H|submissionType|organisationIdNo|organisationName|batchIndicator|...
 *   Detail records:  D|employeeIdNo|employeeName|...income fields...
 *   Trailer record: T|recordCount
 *
 * All monetary values are integer cents internally; output as dollars with 2 decimal places.
 * NRIC is masked — only last 4 chars stored per PDPA rules.
 */

import { centsToDisplay } from "@/lib/utils/money";

interface Ir8aTextEmployee {
  nricLast4: string;
  fullName: string;
  dob: string; // YYYY-MM-DD
  grossSalaryCents: number;
  bonusCents: number;
  directorFeeCents: number;
  commissionCents: number;
  pensionCents: number;
  employeeCpfCents: number;
  employerCpfCents: number;
  donationsCents: number; // SHG contributions
  benefitsInKindCents: number;
  excessCpfCents: number;
}

interface Ir8aTextInput {
  companyUen: string;
  companyName: string;
  yearOfAssessment: number;
  employees: Ir8aTextEmployee[];
}

interface Ir8aTextResult {
  filename: string;
  content: string;
}

/** Format integer cents to AIS dollar string: 123456 -> "1234.56" (no commas) */
function toDollars(cents: number): string {
  return centsToDisplay(cents).replace(/,/g, "");
}

/** Format date from YYYY-MM-DD to DDMMYYYY for AIS */
function toAisDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return "00000000";
  const parts = dateStr.split("-");
  return `${parts[2]}${parts[1]}${parts[0]}`;
}

/**
 * Generate IRAS AIS-compatible pipe-delimited text file for IR8A submission.
 *
 * The AIS file is the standard electronic submission format accepted by IRAS
 * for employer tax filing under the Auto-Inclusion Scheme.
 */
export function generateIr8aTextFile(data: Ir8aTextInput): Ir8aTextResult {
  const lines: string[] = [];
  const basisYear = data.yearOfAssessment - 1; // Basis year = YA - 1

  // ---------- Header Record ----------
  // H|SubmissionType|OrgIdType|OrgIdNo|OrgName|BasisYear|
  // AuthorisedPersonName|AuthorisedPersonDesignation|Telephone|
  // BatchDate|BatchIndicator
  const headerFields = [
    "H", // Record type
    "O", // Submission type: O = Original
    "7", // Organisation ID type: 7 = UEN
    data.companyUen, // Organisation ID number
    sanitize(data.companyName), // Organisation name
    String(basisYear), // Basis year (income year)
    sanitize(data.companyName), // Authorised person name (company name as fallback)
    "Director", // Authorised person designation
    "", // Telephone (optional)
    formatBatchDate(), // Batch date DDMMYYYY
    "T", // Batch indicator: T = Test, O = Original
  ];
  lines.push(headerFields.join("|"));

  // ---------- Detail Records ----------
  for (const emp of data.employees) {
    // Total income = salary + bonus + director fees + commission + pension
    const totalIncomeCents =
      emp.grossSalaryCents +
      emp.bonusCents +
      emp.directorFeeCents +
      emp.commissionCents +
      emp.pensionCents;

    const detailFields = [
      "D", // Record type
      `XXXXX${emp.nricLast4}`, // Employee ID (masked NRIC)
      sanitize(emp.fullName), // Employee name
      toAisDate(emp.dob), // Date of birth DDMMYYYY
      "", // Sex (M/F) - not stored
      "", // Nationality - optional in AIS
      "", // Address line 1
      "", // Address line 2
      "", // Address line 3
      "", // Postal code
      String(basisYear), // Basis year
      toDollars(emp.grossSalaryCents), // Gross salary (Section 45(1))
      toDollars(emp.bonusCents), // Bonus (Section 45(2))
      toDollars(emp.directorFeeCents), // Director fees
      toDollars(emp.commissionCents), // Commission
      toDollars(emp.pensionCents), // Pension
      toDollars(0), // Transport allowance
      toDollars(0), // Entertainment allowance
      toDollars(0), // Other allowances
      toDollars(totalIncomeCents), // Total income
      toDollars(emp.employeeCpfCents), // Employee CPF contributions
      toDollars(emp.employerCpfCents), // Employer CPF contributions (voluntary)
      toDollars(emp.donationsCents), // Donations / SHG contributions
      toDollars(0), // Mosque building fund
      toDollars(emp.benefitsInKindCents), // Benefits-in-kind
      toDollars(0), // Section 45 gains
      toDollars(emp.excessCpfCents), // Excess / voluntary CPF
      toDollars(0), // Gains from ESOP/ESOW
      toDollars(0), // Tax borne by employer
      "", // Commencement date
      "", // Cessation date
      "N", // IR8S indicator (N = not applicable)
      "N", // Appendix 8A indicator
      "N", // Appendix 8B indicator
    ];
    lines.push(detailFields.join("|"));
  }

  // ---------- Trailer Record ----------
  lines.push(`T|${data.employees.length}`);

  const filename = `IR8A_AIS_${data.companyUen}_YA${data.yearOfAssessment}.txt`;

  return {
    filename,
    content: lines.join("\r\n"),
  };
}

/** Remove pipe characters and trim whitespace from strings for AIS safety */
function sanitize(str: string): string {
  return str.replace(/\|/g, " ").trim();
}

/** Format current date as DDMMYYYY */
function formatBatchDate(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  return `${dd}${mm}${yyyy}`;
}
