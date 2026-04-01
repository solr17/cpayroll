/**
 * OCBC Business Internet Banking (BIB) bulk payment file.
 * Fixed-width text format.
 */

import type { BankPaymentRecord, BankFileResult } from "./types";

function pad(str: string, len: number): string {
  return str.padEnd(len).slice(0, len);
}

function padNum(num: number, len: number): string {
  return String(num).padStart(len, "0").slice(0, len);
}

export function generateOcbcFile(
  records: BankPaymentRecord[],
  companyCode: string,
  debitAccountNo: string,
  paymentDate: string,
  batchRef: string,
): BankFileResult {
  const lines: string[] = [];
  const dateFormatted = paymentDate.replace(/-/g, "");

  // Header
  lines.push(
    [
      "H",
      pad(companyCode, 10),
      pad(debitAccountNo, 20),
      dateFormatted,
      pad(batchRef, 20),
      padNum(records.length, 6),
    ].join(""),
  );

  let totalCents = 0;

  for (const rec of records) {
    totalCents += rec.amountCents;
    lines.push(
      [
        "D",
        pad(rec.bankCode, 4),
        pad(rec.branchCode, 3),
        pad(rec.accountNumber, 20),
        padNum(rec.amountCents, 15),
        pad(rec.reference, 20),
        pad(rec.employeeName, 40),
      ].join(""),
    );
  }

  // Trailer
  lines.push(["T", padNum(records.length, 6), padNum(totalCents, 15)].join(""));

  return {
    filename: `OCBC_BIB_${batchRef}_${paymentDate}.txt`,
    content: lines.join("\r\n"),
    format: "OCBC BIB",
    recordCount: records.length,
    totalAmountCents: totalCents,
  };
}
