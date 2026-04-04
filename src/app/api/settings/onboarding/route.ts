import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const onboardingSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  uen: z.string().min(1, "UEN is required"),
  address: z.string().optional(),
  cpfSubmissionNumber: z.string().optional(),
  irasTaxRef: z.string().optional(),
  bankAccount: z.object({
    bankName: z.string().min(1, "Bank name is required"),
    branchCode: z.string().min(1, "Branch code is required"),
    accountNumber: z.string().min(1, "Account number is required"),
  }),
  payDay: z.number().int().min(1).max(28),
});

/** POST /api/settings/onboarding — Complete initial company setup */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const body = await request.json();
    const parsed = onboardingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Invalid input",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const data = parsed.data;

    await db
      .update(companies)
      .set({
        name: data.name,
        uen: data.uen,
        addressJson: data.address ? { address: data.address } : null,
        bankAccountJson: data.bankAccount,
        cpfSubmissionNumber: data.cpfSubmissionNumber ?? null,
        irasTaxRef: data.irasTaxRef ?? null,
        payDay: data.payDay,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, session.companyId));

    await logAudit({
      userId: session.id,
      action: "complete_onboarding",
      entityType: "company",
      entityId: session.companyId,
      newValue: { name: data.name, uen: data.uen },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({ success: true } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
