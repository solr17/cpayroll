/**
 * UOB BIB Online bulk payment upload.
 * CSV format with UOB-specific field mapping.
 */

import type { BankPaymentRecord, BankFileResult } from "./types";
import { centsToDisplay } from "@/lib/utils/money";

export function generateUobFile(
  records: BankPaymentRecord[],
  debitAccountNo: string,
  paymentDate: string,
  batchRef: string,
): BankFileResult {
  const lines: string[] = [];
  const dateFormatted = paymentDate.replace(/-/g, "");

  // Header
  lines.push(
    [
      "Payment Date",
      "Debit Account",
      "Beneficiary Name",
      "Beneficiary Bank Code",
      "Beneficiary Account",
      "Amount",
      "Reference",
      "Payment Type",
    ].join(","),
  );

  let totalCents = 0;

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
        "GIRO",
      ].join(","),
    );
  }

  return {
    filename: `UOB_BIB_${batchRef}_${paymentDate}.csv`,
    content: lines.join("\r\n"),
    format: "UOB BIB CSV",
    recordCount: records.length,
    totalAmountCents: totalCents,
  };
}
