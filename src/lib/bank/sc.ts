/**
 * Standard Chartered BizNet bulk payment upload.
 * CSV format with column headers.
 */

import type { BankPaymentRecord, BankFileResult } from "./types";
import { centsToDisplay } from "@/lib/utils/money";

export function generateScFile(
  records: BankPaymentRecord[],
  companyCode: string,
  debitAccountNo: string,
  paymentDate: string,
  batchRef: string,
): BankFileResult {
  const lines: string[] = [];
  const dateFormatted = paymentDate.replace(/-/g, "");

  // Column headers
  lines.push(
    [
      "Payment Date",
      "Debit Account",
      "Company Code",
      "Beneficiary Name",
      "Beneficiary Bank",
      "Beneficiary Branch",
      "Beneficiary Account",
      "Amount",
      "Reference",
    ].join(","),
  );

  let totalCents = 0;

  // Detail rows
  for (const rec of records) {
    totalCents += rec.amountCents;

    lines.push(
      [
        dateFormatted,
        debitAccountNo,
        companyCode,
        `"${rec.employeeName}"`,
        rec.bankCode,
        rec.branchCode,
        rec.accountNumber,
        centsToDisplay(rec.amountCents).replace(/,/g, ""),
        rec.reference,
      ].join(","),
    );
  }

  return {
    filename: `SC_GIRO_${batchRef}_${paymentDate}.csv`,
    content: lines.join("\r\n"),
    format: "Standard Chartered BizNet CSV",
    recordCount: records.length,
    totalAmountCents: totalCents,
  };
}
