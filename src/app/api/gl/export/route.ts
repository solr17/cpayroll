import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { glJournalEntries, payRuns } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { centsToDisplay } from "@/lib/utils/money";
import type { ApiResponse } from "@/types";

/** GET /api/gl/export?payRunId=X — Export journal entries as CSV for Xero/QuickBooks import */
export async function GET(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const { searchParams } = new URL(request.url);
    const payRunId = searchParams.get("payRunId");

    if (!payRunId) {
      return NextResponse.json(
        { success: false, error: "payRunId query parameter is required" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Verify the pay run belongs to this company
    const [run] = await db
      .select({ id: payRuns.id })
      .from(payRuns)
      .where(and(eq(payRuns.id, payRunId), eq(payRuns.companyId, session.companyId)))
      .limit(1);

    if (!run) {
      return NextResponse.json(
        { success: false, error: "Pay run not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    const entries = await db
      .select()
      .from(glJournalEntries)
      .where(
        and(
          eq(glJournalEntries.payRunId, payRunId),
          eq(glJournalEntries.companyId, session.companyId),
        ),
      )
      .orderBy(glJournalEntries.accountCode);

    if (entries.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No journal entries found for this pay run. Generate entries first.",
        } satisfies ApiResponse,
        { status: 404 },
      );
    }

    // Build CSV
    const csvHeader = "Date,Account Code,Account Name,Description,Debit,Credit,Department";
    const csvRows = entries.map((entry: (typeof entries)[number]) => {
      const date = entry.entryDate;
      const code = escapeCsvField(entry.accountCode);
      const name = escapeCsvField(entry.accountName);
      const description = escapeCsvField(entry.description);
      const debit = entry.debitCents > 0 ? centsToDisplay(entry.debitCents) : "";
      const credit = entry.creditCents > 0 ? centsToDisplay(entry.creditCents) : "";
      const department = escapeCsvField(entry.department ?? "");
      return `${date},${code},${name},${description},${debit},${credit},${department}`;
    });

    const csv = [csvHeader, ...csvRows].join("\r\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gl-journal-${payRunId.slice(0, 8)}.csv"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** Escape a field for CSV: wrap in quotes if it contains comma, quote, or newline */
function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
