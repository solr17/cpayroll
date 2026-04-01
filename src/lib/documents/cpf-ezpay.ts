/**
 * CPF EZPay File Generation.
 * CSV format for manual upload to CPF EZPay portal.
 * Includes employee NRIC (last 4 only in reference), OW, AW, employer/employee contributions.
 */

import { centsToDisplay } from "@/lib/utils/money";

interface CpfSubmissionRecord {
  nricLast4: string;
  employeeName: string;
  owCents: number;
  awCents: number;
  employerCpfCents: number;
  employeeCpfCents: number;
  totalCpfCents: number;
}

interface CpfFileResult {
  filename: string;
  content: string;
  recordCount: number;
  totalEmployerCents: number;
  totalEmployeeCents: number;
  totalSdlCents: number;
}

export function generateCpfEzPayFile(
  records: CpfSubmissionRecord[],
  companyUen: string,
  periodYearMonth: string, // "202603"
  totalSdlCents: number,
): CpfFileResult {
  const lines: string[] = [];

  // Header
  lines.push(
    [
      "CPF Submission Number",
      "Employer UEN",
      "Payment Period",
      "Employee NRIC/FIN",
      "Employee Name",
      "Ordinary Wages",
      "Additional Wages",
      "Employer CPF",
      "Employee CPF",
      "Total CPF",
    ].join(","),
  );

  let totalEmployer = 0;
  let totalEmployee = 0;

  for (const rec of records) {
    totalEmployer += rec.employerCpfCents;
    totalEmployee += rec.employeeCpfCents;

    lines.push(
      [
        "", // CPF submission number (filled by portal)
        companyUen,
        periodYearMonth,
        `XXXXX${rec.nricLast4}`, // Masked NRIC
        `"${rec.employeeName}"`,
        centsToDisplay(rec.owCents),
        centsToDisplay(rec.awCents),
        centsToDisplay(rec.employerCpfCents),
        centsToDisplay(rec.employeeCpfCents),
        centsToDisplay(rec.totalCpfCents),
      ].join(","),
    );
  }

  return {
    filename: `CPF_EZPay_${companyUen}_${periodYearMonth}.csv`,
    content: lines.join("\r\n"),
    recordCount: records.length,
    totalEmployerCents: totalEmployer,
    totalEmployeeCents: totalEmployee,
    totalSdlCents,
  };
}
