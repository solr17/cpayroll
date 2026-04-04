import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["owner", "admin", "payroll_operator", "report_viewer", "employee"]),
});

/** GET /api/users — List users for the company */
export async function GET() {
  try {
    const session = await requireRole("owner", "admin");

    const userList = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        totpEnabled: users.totpEnabled,
        employeeId: users.employeeId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.companyId, session.companyId));

    return NextResponse.json({ success: true, data: userList } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** POST /api/users — Create a new user (owner only) */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner");
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message ?? "Invalid input",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const { name, email, password, role } = parsed.data;

    // Check if email already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { success: false, error: "A user with this email already exists" } satisfies ApiResponse,
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [newUser] = await db
      .insert(users)
      .values({
        companyId: session.companyId,
        email: email.toLowerCase(),
        passwordHash,
        name,
        role,
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      });

    await logAudit({
      userId: session.id,
      action: "create_user",
      entityType: "user",
      entityId: newUser?.id,
      newValue: { email: email.toLowerCase(), name, role },
    });

    return NextResponse.json({ success: true, data: newUser } satisfies ApiResponse, {
      status: 201,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
