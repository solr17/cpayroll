/**
 * HSBC HSBCnet GIRO Interbank GIRO (IBG) file format.
 * CSV with header/detail/trailer records.
 */

import type { BankPaymentRecord, BankFileResult } from "./types";
import { centsToDisplay } from "@/lib/utils/money";

export function generateHsbcFile(
  records: BankPaymentRecord[],
  companyCode: string,
  debitAccountNo: string,
  paymentDate: string,
  batchRef: string,
): BankFileResult {
  const lines: string[] = [];
  const dateFormatted = paymentDate.replace(/-/g, "");

  // Header record
  lines.push(
    [
      "H",
      "HSBC",
      companyCode,
      debitAccountNo,
      dateFormatted,
      batchRef,
      String(records.length).padStart(6, "0"),
    ].join(","),
  );

  let totalCents = 0;

  // Detail records
  for (const rec of records) {
    const amountStr = centsToDisplay(rec.amountCents).replace(/,/g, "");
    totalCents += rec.amountCents;

    lines.push(
      [
        "D",
        rec.bankCode,
        rec.branchCode,
        rec.accountNumber,
        amountStr,
        rec.reference,
        rec.employeeName,
      ].join(","),
    );
  }

  // Trailer record
  lines.push(
    [
      "T",
      String(records.length).padStart(6, "0"),
      centsToDisplay(totalCents).replace(/,/g, ""),
    ].join(","),
  );

  return {
    filename: `HSBC_GIRO_${batchRef}_${paymentDate}.csv`,
    content: lines.join("\r\n"),
    format: "HSBC HSBCnet GIRO",
    recordCount: records.length,
    totalAmountCents: totalCents,
  };
}
