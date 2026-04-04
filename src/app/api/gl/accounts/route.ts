import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { glAccounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const createAccountSchema = z.object({
  accountCode: z.string().min(1, "Account code is required").max(20),
  accountName: z.string().min(1, "Account name is required").max(100),
  accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  payItemMapping: z.string().min(1, "Pay item mapping is required"),
  isActive: z.boolean().optional().default(true),
});

/** GET /api/gl/accounts — List GL accounts for the company */
export async function GET() {
  try {
    const session = await requireRole("owner", "admin");

    const accounts = await db
      .select()
      .from(glAccounts)
      .where(eq(glAccounts.companyId, session.companyId))
      .orderBy(glAccounts.accountCode);

    return NextResponse.json({ success: true, data: accounts } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** POST /api/gl/accounts — Create a new GL account mapping */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const body = await request.json();
    const parsed = createAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Validation failed",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const { accountCode, accountName, accountType, payItemMapping, isActive } = parsed.data;

    // Check for duplicate account code within the company
    const [existing] = await db
      .select({ id: glAccounts.id })
      .from(glAccounts)
      .where(
        and(eq(glAccounts.companyId, session.companyId), eq(glAccounts.accountCode, accountCode)),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: `Account code ${accountCode} already exists`,
        } satisfies ApiResponse,
        { status: 409 },
      );
    }

    const [account] = await db
      .insert(glAccounts)
      .values({
        companyId: session.companyId,
        accountCode,
        accountName,
        accountType,
        payItemMapping,
        isActive,
      })
      .returning();

    await logAudit({
      userId: session.id,
      action: "gl_account_created",
      entityType: "gl_account",
      entityId: account.id,
      newValue: { accountCode, accountName, accountType, payItemMapping },
    });

    return NextResponse.json({ success: true, data: account } satisfies ApiResponse, {
      status: 201,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** PATCH /api/gl/accounts — Update a GL account */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const body = await request.json();
    const { id, ...updates } = body as { id: string; [key: string]: unknown };

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Account id is required" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Verify ownership
    const [existing] = await db
      .select()
      .from(glAccounts)
      .where(and(eq(glAccounts.id, id), eq(glAccounts.companyId, session.companyId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Account not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    const allowedFields: Record<string, unknown> = {};
    if (typeof updates.accountCode === "string") allowedFields.accountCode = updates.accountCode;
    if (typeof updates.accountName === "string") allowedFields.accountName = updates.accountName;
    if (typeof updates.accountType === "string") allowedFields.accountType = updates.accountType;
    if (typeof updates.payItemMapping === "string")
      allowedFields.payItemMapping = updates.payItemMapping;
    if (typeof updates.isActive === "boolean") allowedFields.isActive = updates.isActive;

    const [updated] = await db
      .update(glAccounts)
      .set({ ...allowedFields, updatedAt: new Date() })
      .where(eq(glAccounts.id, id))
      .returning();

    await logAudit({
      userId: session.id,
      action: "gl_account_updated",
      entityType: "gl_account",
      entityId: id,
      oldValue: existing,
      newValue: updated,
    });

    return NextResponse.json({ success: true, data: updated } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** DELETE /api/gl/accounts — Delete a GL account */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Account id is required" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const [existing] = await db
      .select()
      .from(glAccounts)
      .where(and(eq(glAccounts.id, id), eq(glAccounts.companyId, session.companyId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Account not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    await db.delete(glAccounts).where(eq(glAccounts.id, id));

    await logAudit({
      userId: session.id,
      action: "gl_account_deleted",
      entityType: "gl_account",
      entityId: id,
      oldValue: existing,
    });

    return NextResponse.json({ success: true } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
