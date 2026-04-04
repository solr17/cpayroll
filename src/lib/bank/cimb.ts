/**
 * CIMB BizChannel bulk payment upload.
 * CSV format with column headers.
 */

import type { BankPaymentRecord, BankFileResult } from "./types";
import { centsToDisplay } from "@/lib/utils/money";

export function generateCimbFile(
  records: BankPaymentRecord[],
  debitAccountNo: string,
  paymentDate: string,
  batchRef: string,
): BankFileResult {
  const lines: string[] = [];
  const dateFormatted = paymentDate.replace(/-/g, "");

  // Column headers
  lines.push(
    [
      "Transaction Date",
      "Originator Account",
      "Beneficiary Name",
      "Beneficiary Bank Code",
      "Beneficiary Account",
      "Amount",
      "Description",
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
        `"${rec.employeeName}"`,
        rec.bankCode,
        rec.accountNumber,
        centsToDisplay(rec.amountCents).replace(/,/g, ""),
        rec.reference,
      ].join(","),
    );
  }

  return {
    filename: `CIMB_GIRO_${batchRef}_${paymentDate}.csv`,
    content: lines.join("\r\n"),
    format: "CIMB BizChannel CSV",
    recordCount: records.length,
    totalAmountCents: totalCents,
  };
}
