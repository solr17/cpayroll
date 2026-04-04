import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { glJournalEntries } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { generateGlEntries } from "@/lib/gl/generate";
import type { ApiResponse } from "@/types";

/** GET /api/gl/journal/[payRunId] — Get journal entries for a pay run */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ payRunId: string }> },
) {
  try {
    const session = await requireRole("owner", "admin");
    const { payRunId } = await params;

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

    return NextResponse.json({ success: true, data: entries } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** POST /api/gl/journal/[payRunId] — Generate journal entries for a pay run */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ payRunId: string }> },
) {
  try {
    const session = await requireRole("owner", "admin");
    const { payRunId } = await params;

    const entries = await generateGlEntries(payRunId, session.companyId, session.id);

    return NextResponse.json({ success: true, data: entries } satisfies ApiResponse, {
      status: 201,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** DELETE /api/gl/journal/[payRunId] — Delete journal entries for a pay run (to allow regeneration) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ payRunId: string }> },
) {
  try {
    const session = await requireRole("owner", "admin");
    const { payRunId } = await params;

    await db
      .delete(glJournalEntries)
      .where(
        and(
          eq(glJournalEntries.payRunId, payRunId),
          eq(glJournalEntries.companyId, session.companyId),
        ),
      );

    return NextResponse.json({ success: true } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
