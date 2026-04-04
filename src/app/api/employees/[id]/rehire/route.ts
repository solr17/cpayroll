import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const rehireSchema = z.object({
  hireDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
});

/** POST /api/employees/:id/rehire — Rehire a terminated employee */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;

    const body = await request.json();
    const parsed = rehireSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message ?? "Invalid input",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const [employee] = await db
      .select({ id: employees.id, fullName: employees.fullName, status: employees.status })
      .from(employees)
      .where(and(eq(employees.id, id), eq(employees.companyId, session.companyId)))
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    if (employee.status !== "terminated") {
      return NextResponse.json(
        { success: false, error: "Only terminated employees can be rehired" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {
      terminationDate: null,
      terminationReason: null,
      status: "active",
      updatedAt: new Date(),
    };

    if (parsed.data.hireDate) {
      updates.hireDate = parsed.data.hireDate;
    }

    await db.update(employees).set(updates).where(eq(employees.id, id));

    await logAudit({
      userId: session.id,
      action: "rehire_employee",
      entityType: "employee",
      entityId: id,
      newValue: { status: "active", newHireDate: parsed.data.hireDate ?? null },
    });

    return NextResponse.json({
      success: true,
      data: { id, status: "active" },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
