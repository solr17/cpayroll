import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { transitionPayRun } from "@/lib/payroll/pay-run";
import { dispatchWebhook } from "@/lib/webhooks/dispatch";
import { z } from "zod";
import type { ApiResponse, PayRunStatus } from "@/types";

const transitionSchema = z.object({
  status: z.enum(["calculated", "reviewed", "approved", "paid", "filed"]),
});

/** POST /api/payroll/pay-runs/[id]/transition — Transition pay run status */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;
    const body = await request.json();
    const parsed = transitionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Invalid status value",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const newStatus = parsed.data.status as PayRunStatus;

    const result = await transitionPayRun(id, session.companyId, newStatus, session.id);

    // Fire-and-forget webhook dispatch for approved/paid transitions
    if (newStatus === "approved") {
      dispatchWebhook(session.companyId, "payroll.approved", { payRunId: id }).catch(() => {});
    } else if (newStatus === "paid") {
      dispatchWebhook(session.companyId, "payroll.paid", { payRunId: id }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      data: {
        payRunId: id,
        status: result.status,
        transitioned: result.transitioned,
        message: result.message,
        dualApproval: result.dualApproval,
      },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    let status = 500;
    if (message.startsWith("Unauthorized")) status = 401;
    else if (message === "Pay run not found") status = 404;
    else if (message.startsWith("Invalid transition")) status = 409;
    else if (message.startsWith("Dual approval requires")) status = 409;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
