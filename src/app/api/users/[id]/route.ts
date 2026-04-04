import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const updateRoleSchema = z.object({
  role: z.enum(["owner", "admin", "payroll_operator", "report_viewer", "employee"]),
});

/** PATCH /api/users/:id — Update user role (owner only) */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner");
    const { id } = await params;

    const body = await request.json();
    const parsed = updateRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid role" } satisfies ApiResponse, {
        status: 400,
      });
    }

    const [user] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(and(eq(users.id, id), eq(users.companyId, session.companyId)))
      .limit(1);

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" } satisfies ApiResponse, {
        status: 404,
      });
    }

    const oldRole = user.role;
    const { role: newRole } = parsed.data;

    await db.update(users).set({ role: newRole, updatedAt: new Date() }).where(eq(users.id, id));

    await logAudit({
      userId: session.id,
      action: "update_user_role",
      entityType: "user",
      entityId: id,
      oldValue: { role: oldRole },
      newValue: { role: newRole },
    });

    return NextResponse.json({ success: true, data: { id, role: newRole } } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** DELETE /api/users/:id — Deactivate user (owner only, cannot deactivate self) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole("owner");
    const { id } = await params;

    if (id === session.id) {
      return NextResponse.json(
        { success: false, error: "Cannot deactivate your own account" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.id, id), eq(users.companyId, session.companyId)))
      .limit(1);

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" } satisfies ApiResponse, {
        status: 404,
      });
    }

    // Deactivate by setting role to 'employee' and clearing login capability
    // In a full system we'd have an 'active' flag; here we remove the password hash
    await db
      .update(users)
      .set({
        passwordHash: "DEACTIVATED",
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    await logAudit({
      userId: session.id,
      action: "deactivate_user",
      entityType: "user",
      entityId: id,
      oldValue: { name: user.name, email: user.email },
    });

    return NextResponse.json({
      success: true,
      data: { id, deactivated: true },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
