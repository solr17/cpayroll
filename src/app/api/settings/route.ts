import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import type { ApiResponse } from "@/types";

/** Mask a string for safe display: "abc123xyz" → "abc1****" */
function maskString(value: string, visibleChars = 4): string {
  if (value.length <= visibleChars) return "****";
  return value.slice(0, visibleChars) + "****";
}

/** GET /api/settings — Get company settings */
export async function GET(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");

    // Handle DBS connection test
    const check = request.nextUrl.searchParams.get("check");
    if (check === "dbs") {
      const clientId = process.env.DBS_RAPID_CLIENT_ID;
      if (!clientId) {
        return NextResponse.json({
          success: false,
          error: "DBS RAPID API is not configured",
        } satisfies ApiResponse);
      }

      try {
        const { testDbsConnection } = await import("@/lib/bank/dbs-rapid");
        const connected = await testDbsConnection();
        return NextResponse.json({
          success: true,
          data: { dbsConnected: connected },
        } satisfies ApiResponse);
      } catch {
        return NextResponse.json({
          success: false,
          error: "DBS RAPID connection test failed",
        } satisfies ApiResponse);
      }
    }

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, session.companyId))
      .limit(1);

    if (!company) {
      return NextResponse.json(
        { success: false, error: "Company not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    // Augment response with DBS RAPID configuration status
    const dbsClientId = process.env.DBS_RAPID_CLIENT_ID;
    const dbsDebitAccount = process.env.DBS_RAPID_DEBIT_ACCOUNT;

    const dbsInfo = {
      dbsRapidConfigured: !!dbsClientId,
      dbsClientIdMasked: dbsClientId ? maskString(dbsClientId) : null,
      dbsDebitAccountMasked: dbsDebitAccount ? maskString(dbsDebitAccount) : null,
    };

    return NextResponse.json({
      success: true,
      data: { ...company, ...dbsInfo },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

const updateSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  uen: z.string().min(1).optional(),
  addressJson: z.record(z.string()).optional(),
  cpfSubmissionNumber: z.string().optional().nullable(),
  irasTaxRef: z.string().optional().nullable(),
  payDay: z.number().int().min(1).max(28).optional(),
  bankAccountJson: z
    .object({
      bankName: z.string(),
      accountNumber: z.string(),
      branchCode: z.string(),
    })
    .optional()
    .nullable(),
  dualApprovalThresholdCents: z.number().int().min(0).optional(),
});

/** PATCH /api/settings — Update company settings */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Validation failed",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const input = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.uen !== undefined) updateData.uen = input.uen;
    if (input.addressJson !== undefined) updateData.addressJson = input.addressJson;
    if (input.cpfSubmissionNumber !== undefined)
      updateData.cpfSubmissionNumber = input.cpfSubmissionNumber;
    if (input.irasTaxRef !== undefined) updateData.irasTaxRef = input.irasTaxRef;
    if (input.payDay !== undefined) updateData.payDay = input.payDay;
    if (input.bankAccountJson !== undefined) updateData.bankAccountJson = input.bankAccountJson;
    if (input.dualApprovalThresholdCents !== undefined)
      updateData.dualApprovalThresholdCents = input.dualApprovalThresholdCents;
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(companies)
      .set(updateData)
      .where(eq(companies.id, session.companyId))
      .returning();

    await logAudit({
      userId: session.id,
      action: "update_company_settings",
      entityType: "company",
      entityId: session.companyId,
      newValue: { changedFields: Object.keys(input) },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({ success: true, data: updated } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
