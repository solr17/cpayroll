import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { detectVariances } from "@/lib/payroll/variance";
import type { ApiResponse } from "@/types";

/** GET /api/payroll/pay-runs/[id]/variance — Detect payroll variance alerts */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;

    const alerts = await detectVariances(id, session.companyId);

    return NextResponse.json({
      success: true,
      data: alerts,
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
