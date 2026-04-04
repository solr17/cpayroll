import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import type { ApiResponse } from "@/types";

interface CsvRow {
  amount: string;
  reference: string;
  date: string;
  description?: string;
}

/**
 * Parse a bank statement CSV.
 * Expects headers: amount, reference, date (at minimum).
 * Handles common formats: quoted fields, various date formats.
 */
function parseBankStatementCsv(csvText: string): CsvRow[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse header row to find column indices
  const headerLine = lines[0]!;
  const headers = parseCsvLine(headerLine).map((h) => h.toLowerCase().trim());

  const amountIdx = headers.findIndex(
    (h) => h.includes("amount") || h.includes("sum") || h.includes("value"),
  );
  const refIdx = headers.findIndex(
    (h) => h.includes("reference") || h.includes("ref") || h.includes("transaction"),
  );
  const dateIdx = headers.findIndex((h) => h.includes("date"));
  const descIdx = headers.findIndex(
    (h) => h.includes("description") || h.includes("desc") || h.includes("particular"),
  );

  if (amountIdx === -1) return [];

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    const fields = parseCsvLine(line);
    const amount = fields[amountIdx]?.trim() ?? "";
    if (!amount) continue;

    rows.push({
      amount,
      reference: refIdx >= 0 ? (fields[refIdx]?.trim() ?? "") : "",
      date: dateIdx >= 0 ? (fields[dateIdx]?.trim() ?? "") : "",
      description: descIdx >= 0 ? (fields[descIdx]?.trim() ?? "") : "",
    });
  }

  return rows;
}

/** Parse a single CSV line handling quoted fields */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Parse amount string to integer cents.
 * Handles: "1,234.56", "1234.56", "$1,234.56", "S$1,234.56"
 */
function parseAmountToCents(amountStr: string): number | null {
  const cleaned = amountStr.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;

  const parts = cleaned.split(".");
  const dollars = parseInt(parts[0] ?? "0", 10);
  const cents = parseInt((parts[1] ?? "0").padEnd(2, "0").slice(0, 2), 10);
  if (isNaN(dollars) || isNaN(cents)) return null;

  const sign = cleaned.startsWith("-") ? -1 : 1;
  return sign * (Math.abs(dollars) * 100 + cents);
}

interface MatchResult {
  paymentId: string;
  employeeName: string;
  amountCents: number;
  bankReference: string;
  matchType: "exact_ref" | "amount_match";
}

/** POST /api/payments/reconcile — Upload bank statement CSV to reconcile */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");

    const contentType = request.headers.get("content-type") ?? "";

    let csvText: string;
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json(
          { success: false, error: "No CSV file uploaded" } satisfies ApiResponse,
          { status: 400 },
        );
      }
      csvText = await file.text();
    } else {
      // Accept raw CSV text in body
      const body = await request.json();
      csvText = body.csv;
      if (!csvText || typeof csvText !== "string") {
        return NextResponse.json(
          { success: false, error: "No CSV data provided" } satisfies ApiResponse,
          { status: 400 },
        );
      }
    }

    const csvRows = parseBankStatementCsv(csvText);
    if (csvRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No valid rows found in CSV. Ensure headers include 'amount'.",
        } satisfies ApiResponse,
        { status: 422 },
      );
    }

    // Fetch all pending/submitted payments for this company
    const pendingPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.companyId, session.companyId),
          sql`${payments.status} IN ('pending', 'submitted', 'processing')`,
        ),
      );

    const matched: MatchResult[] = [];
    const unmatched: CsvRow[] = [];
    const matchedPaymentIds: string[] = [];
    const usedPaymentIds = new Set<string>();

    for (const csvRow of csvRows) {
      const csvAmountCents = parseAmountToCents(csvRow.amount);
      if (csvAmountCents === null || csvAmountCents <= 0) {
        unmatched.push(csvRow);
        continue;
      }

      let found = false;

      // Strategy 1: Match by bank reference (exact)
      if (csvRow.reference) {
        const refMatch = pendingPayments.find(
          (p: (typeof pendingPayments)[number]) =>
            !usedPaymentIds.has(p.id) &&
            p.bankReference &&
            p.bankReference.toLowerCase() === csvRow.reference.toLowerCase() &&
            p.amountCents === csvAmountCents,
        );
        if (refMatch) {
          matched.push({
            paymentId: refMatch.id,
            employeeName: refMatch.employeeName,
            amountCents: refMatch.amountCents,
            bankReference: csvRow.reference,
            matchType: "exact_ref",
          });
          matchedPaymentIds.push(refMatch.id);
          usedPaymentIds.add(refMatch.id);
          found = true;
        }
      }

      // Strategy 2: Match by amount (first unmatched payment with same amount)
      if (!found) {
        const amountMatch = pendingPayments.find(
          (p: (typeof pendingPayments)[number]) =>
            !usedPaymentIds.has(p.id) && p.amountCents === csvAmountCents,
        );
        if (amountMatch) {
          matched.push({
            paymentId: amountMatch.id,
            employeeName: amountMatch.employeeName,
            amountCents: amountMatch.amountCents,
            bankReference: csvRow.reference || "",
            matchType: "amount_match",
          });
          matchedPaymentIds.push(amountMatch.id);
          usedPaymentIds.add(amountMatch.id);
          found = true;
        }
      }

      if (!found) {
        unmatched.push(csvRow);
      }
    }

    // Mark matched payments as completed
    if (matchedPaymentIds.length > 0) {
      await db
        .update(payments)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(payments.companyId, session.companyId), inArray(payments.id, matchedPaymentIds)),
        );

      // Update bank references for matches that had them
      for (const m of matched) {
        if (m.bankReference) {
          await db
            .update(payments)
            .set({ bankReference: m.bankReference })
            .where(eq(payments.id, m.paymentId));
        }
      }
    }

    await logAudit({
      userId: session.id,
      action: "reconcile_payments",
      entityType: "payment",
      newValue: {
        csvRows: csvRows.length,
        matched: matched.length,
        unmatched: unmatched.length,
      },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        matched: matched.length,
        unmatched: unmatched.length,
        details: matched,
        unmatchedRows: unmatched,
      },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
