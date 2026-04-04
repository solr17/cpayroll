import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users, employees } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt, encrypt } from "@/lib/crypto/aes";
import { logAudit } from "@/lib/audit/log";
import { z } from "zod";

// Schema for updatable fields
const profileUpdateSchema = z.object({
  email: z.string().email().optional(),
  mobile: z.string().min(1).max(20).optional(),
  emergencyContactName: z.string().min(1).max(100).optional(),
  emergencyContactPhone: z.string().min(1).max(20).optional(),
  bankDetails: z
    .object({
      bankName: z.string().min(1),
      branchCode: z.string().min(1),
      accountNumber: z.string().min(1),
      payNowLinked: z.string().optional(),
    })
    .optional(),
});

async function getEmployeeForUser(userId: string) {
  const [user] = await db
    .select({ employeeId: users.employeeId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.employeeId) return null;

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, user.employeeId))
    .limit(1);

  return employee ?? null;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const employee = await getEmployeeForUser(session.id);
  if (!employee) {
    return NextResponse.json(
      { success: false, error: "No employee record linked to this account" },
      { status: 404 },
    );
  }

  // Decrypt bank details if present
  let bankDetails = null;
  if (employee.bankJsonEncrypted) {
    try {
      bankDetails = JSON.parse(decrypt(employee.bankJsonEncrypted));
    } catch {
      bankDetails = null;
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      fullName: employee.fullName,
      email: employee.email,
      mobile: employee.mobile,
      nricLast4: employee.nricLast4,
      department: employee.department,
      position: employee.position,
      hireDate: employee.hireDate,
      employmentType: employee.employmentType,
      citizenshipStatus: employee.citizenshipStatus,
      emergencyContactName: employee.emergencyContactName,
      emergencyContactPhone: employee.emergencyContactPhone,
      bankDetails,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const employee = await getEmployeeForUser(session.id);
  if (!employee) {
    return NextResponse.json(
      { success: false, error: "No employee record linked to this account" },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 },
    );
  }

  const updates = parsed.data;
  const dbUpdates: Record<string, string | null> = {};

  if (updates.email !== undefined) {
    dbUpdates.email = updates.email;
  }
  if (updates.mobile !== undefined) {
    dbUpdates.mobile = updates.mobile;
  }
  if (updates.emergencyContactName !== undefined) {
    dbUpdates.emergencyContactName = updates.emergencyContactName;
  }
  if (updates.emergencyContactPhone !== undefined) {
    dbUpdates.emergencyContactPhone = updates.emergencyContactPhone;
  }
  if (updates.bankDetails !== undefined) {
    dbUpdates.bankJsonEncrypted = encrypt(JSON.stringify(updates.bankDetails));
  }

  if (Object.keys(dbUpdates).length === 0) {
    return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  }

  // Build old values for audit (exclude encrypted data from log)
  const oldValues: Record<string, string | null> = {};
  const newValues: Record<string, string | null> = {};
  for (const key of Object.keys(dbUpdates)) {
    if (key === "bankJsonEncrypted") {
      oldValues["bankDetails"] = "[encrypted]";
      newValues["bankDetails"] = "[encrypted]";
    } else {
      oldValues[key] = (employee as Record<string, string | null>)[key] ?? null;
      newValues[key] = dbUpdates[key] ?? null;
    }
  }

  await db
    .update(employees)
    .set({ ...dbUpdates, updatedAt: new Date() })
    .where(eq(employees.id, employee.id));

  await logAudit({
    userId: session.id,
    action: "update_own_profile",
    entityType: "employee",
    entityId: employee.id,
    oldValue: oldValues,
    newValue: newValues,
  });

  return NextResponse.json({ success: true });
}
