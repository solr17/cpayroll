import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payItems } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const updatePayItemSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9_]+$/, "Code must be uppercase letters, numbers, and underscores")
    .optional(),
  name: z.string().min(1).max(100).optional(),
  type: z.enum(["earning", "deduction"]).optional(),
  category: z.enum(["fixed", "variable", "statutory"]).optional(),
  cpfApplicable: z.boolean().optional(),
  cpfClassification: z.enum(["OW", "AW", "none"]).optional(),
  sdlApplicable: z.boolean().optional(),
  taxable: z.boolean().optional(),
  glAccountCode: z.string().max(50).nullable().optional(),
});

/** PATCH /api/pay-items/[id] — Update a pay item */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;
    const body = await request.json();
    const parsed = updatePayItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Validation failed",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Fetch existing item
    const [existing] = await db
      .select()
      .from(payItems)
      .where(and(eq(payItems.id, id), eq(payItems.companyId, session.companyId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Pay item not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    const input = parsed.data;

    // System defaults: cannot change code or type
    if (existing.isSystemDefault) {
      if (input.code && input.code !== existing.code) {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot modify code of a system default pay item",
          } satisfies ApiResponse,
          { status: 400 },
        );
      }
      if (input.type && input.type !== existing.type) {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot modify type of a system default pay item",
          } satisfies ApiResponse,
          { status: 400 },
        );
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.code !== undefined) updateData.code = input.code;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.cpfApplicable !== undefined) updateData.cpfApplicable = input.cpfApplicable;
    if (input.cpfClassification !== undefined)
      updateData.cpfClassification = input.cpfClassification;
    if (input.sdlApplicable !== undefined) updateData.sdlApplicable = input.sdlApplicable;
    if (input.taxable !== undefined) updateData.taxable = input.taxable;
    if (input.glAccountCode !== undefined) updateData.glAccountCode = input.glAccountCode;

    const [updated] = await db
      .update(payItems)
      .set(updateData)
      .where(and(eq(payItems.id, id), eq(payItems.companyId, session.companyId)))
      .returning({
        id: payItems.id,
        code: payItems.code,
        name: payItems.name,
      });

    await logAudit({
      userId: session.id,
      action: "update_pay_item",
      entityType: "pay_item",
      entityId: id,
      oldValue: {
        code: existing.code,
        name: existing.name,
        type: existing.type,
      },
      newValue: input,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** DELETE /api/pay-items/[id] — Soft-delete (deactivate) a pay item */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;

    // Fetch existing item
    const [existing] = await db
      .select()
      .from(payItems)
      .where(and(eq(payItems.id, id), eq(payItems.companyId, session.companyId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Pay item not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    if (existing.isSystemDefault) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete a system default pay item",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Soft-delete: set isActive = false
    await db
      .update(payItems)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(payItems.id, id), eq(payItems.companyId, session.companyId)));

    await logAudit({
      userId: session.id,
      action: "deactivate_pay_item",
      entityType: "pay_item",
      entityId: id,
      oldValue: { code: existing.code, isActive: true },
      newValue: { code: existing.code, isActive: false },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: { id, deactivated: true },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
