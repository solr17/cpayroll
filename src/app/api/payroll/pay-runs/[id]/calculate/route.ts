import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { calculatePayRun } from "@/lib/payroll/pay-run";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const variableItemSchema = z.object({
  otHours: z.number().min(0).optional(),
  bonusCents: z.number().int().min(0).optional(),
  commissionCents: z.number().int().min(0).optional(),
  awsCents: z.number().int().min(0).optional(),
  reimbursementCents: z.number().int().min(0).optional(),
  additionalAllowances: z
    .array(
      z.object({
        name: z.string().min(1),
        amountCents: z.number().int().min(0),
        isFixed: z.boolean(),
      }),
    )
    .optional(),
  additionalDeductions: z
    .array(
      z.object({
        name: z.string().min(1),
        amountCents: z.number().int().min(0),
      }),
    )
    .optional(),
  unpaidLeaveDays: z.number().min(0).optional(),
});

const calculateSchema = z.object({
  variableItems: z.record(z.string().uuid(), variableItemSchema).optional(),
});

/** POST /api/payroll/pay-runs/[id]/calculate — Calculate the pay run */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;
    const body = await request.json();
    const parsed = calculateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Validation failed",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const result = await calculatePayRun(
      id,
      session.companyId,
      session.id,
      parsed.data.variableItems as
        | Record<string, Partial<import("@/lib/payroll/types").VariablePayItems>>
        | undefined,
    );

    return NextResponse.json({
      success: true,
      data: {
        employeeCount: result.results.length,
        totalGrossCents: result.totalGross,
        totalNetCents: result.totalNet,
        totalEmployerCpfCents: result.totalEmployerCpf,
        totalEmployeeCpfCents: result.totalEmployeeCpf,
        totalSdlCents: result.totalSdl,
        totalFwlCents: result.totalFwl,
      },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    let status = 500;
    if (message.startsWith("Unauthorized")) status = 401;
    else if (message === "Pay run not found") status = 404;
    else if (message.startsWith("Cannot calculate")) status = 409;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
