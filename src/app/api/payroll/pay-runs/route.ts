import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { createPayRun, listPayRuns } from "@/lib/payroll/pay-run";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const createPayRunSchema = z
  .object({
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
    payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  })
  .refine((data) => data.periodEnd >= data.periodStart, {
    message: "periodEnd must be on or after periodStart",
  })
  .refine((data) => data.payDate >= data.periodStart, {
    message: "payDate must be on or after periodStart",
  });

/** GET /api/payroll/pay-runs — List all pay runs for the company */
export async function GET() {
  try {
    const session = await requireRole("owner", "admin");
    const runs = await listPayRuns(session.companyId);

    return NextResponse.json({
      success: true,
      data: runs,
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** POST /api/payroll/pay-runs — Create a new pay run */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const body = await request.json();
    const parsed = createPayRunSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Validation failed",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const { periodStart, periodEnd, payDate } = parsed.data;

    const run = await createPayRun(session.companyId, periodStart, periodEnd, payDate, session.id);

    return NextResponse.json({ success: true, data: run } satisfies ApiResponse, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
