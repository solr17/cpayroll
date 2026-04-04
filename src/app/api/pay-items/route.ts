import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { payItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const createPayItemSchema = z.object({
  code: z
    .string()
    .min(1, "Code is required")
    .max(50)
    .regex(/^[A-Z0-9_]+$/, "Code must be uppercase letters, numbers, and underscores"),
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["earning", "deduction"]),
  category: z.enum(["fixed", "variable", "statutory"]),
  cpfApplicable: z.boolean().default(true),
  cpfClassification: z.enum(["OW", "AW", "none"]).default("OW"),
  sdlApplicable: z.boolean().default(true),
  taxable: z.boolean().default(true),
  glAccountCode: z.string().max(50).nullable().optional(),
});

/** GET /api/pay-items — List all pay items for company */
export async function GET() {
  try {
    const session = await requireRole("owner", "admin");

    const result = await db
      .select({
        id: payItems.id,
        code: payItems.code,
        name: payItems.name,
        type: payItems.type,
        category: payItems.category,
        cpfApplicable: payItems.cpfApplicable,
        cpfClassification: payItems.cpfClassification,
        sdlApplicable: payItems.sdlApplicable,
        taxable: payItems.taxable,
        isSystemDefault: payItems.isSystemDefault,
        isActive: payItems.isActive,
        glAccountCode: payItems.glAccountCode,
        createdAt: payItems.createdAt,
        updatedAt: payItems.updatedAt,
      })
      .from(payItems)
      .where(eq(payItems.companyId, session.companyId))
      .orderBy(payItems.type, payItems.code);

    return NextResponse.json({ success: true, data: result } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** POST /api/pay-items — Create a new pay item */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const body = await request.json();
    const parsed = createPayItemSchema.safeParse(body);

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

    const [newItem] = await db
      .insert(payItems)
      .values({
        companyId: session.companyId,
        code: input.code,
        name: input.name,
        type: input.type,
        category: input.category,
        cpfApplicable: input.cpfApplicable,
        cpfClassification: input.cpfClassification,
        sdlApplicable: input.sdlApplicable,
        taxable: input.taxable,
        isSystemDefault: false,
        isActive: true,
        glAccountCode: input.glAccountCode ?? null,
      })
      .returning({ id: payItems.id, code: payItems.code, name: payItems.name });

    await logAudit({
      userId: session.id,
      action: "create_pay_item",
      entityType: "pay_item",
      entityId: newItem?.id,
      newValue: { code: input.code, name: input.name, type: input.type },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({ success: true, data: newItem } satisfies ApiResponse, {
      status: 201,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
