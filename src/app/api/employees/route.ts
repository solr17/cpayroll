import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { createEmployeeSchema } from "@/lib/validators/employee";
import { hashNric, nricLast4 } from "@/lib/crypto/nric";
import { encrypt } from "@/lib/crypto/aes";
import { logAudit } from "@/lib/audit/log";
import { maskNric } from "@/lib/crypto/nric";
import type { ApiResponse } from "@/types";

/** GET /api/employees — List all employees */
export async function GET() {
  try {
    const session = await requireRole("owner", "admin");

    const result = await db
      .select({
        id: employees.id,
        fullName: employees.fullName,
        nricLast4: employees.nricLast4,
        position: employees.position,
        department: employees.department,
        employmentType: employees.employmentType,
        citizenshipStatus: employees.citizenshipStatus,
        hireDate: employees.hireDate,
        status: employees.status,
        email: employees.email,
        mobile: employees.mobile,
      })
      .from(employees)
      .where(eq(employees.companyId, session.companyId))
      .orderBy(employees.fullName);

    const masked = result.map((emp: (typeof result)[number]) => ({
      ...emp,
      nricDisplay: maskNric(emp.nricLast4),
    }));

    return NextResponse.json({ success: true, data: masked } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** POST /api/employees — Create a new employee */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");
    const body = await request.json();
    const parsed = createEmployeeSchema.safeParse(body);

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

    const [newEmployee] = await db
      .insert(employees)
      .values({
        companyId: session.companyId,
        nricFinHash: hashNric(input.nric),
        nricLast4: nricLast4(input.nric),
        fullName: input.fullName,
        dob: input.dob,
        gender: input.gender,
        nationality: input.nationality,
        citizenshipStatus: input.citizenshipStatus,
        prEffectiveDate: input.prEffectiveDate,
        mobile: input.mobile,
        email: input.email,
        addressEncrypted: input.address ? encrypt(input.address) : undefined,
        emergencyContactName: input.emergencyContactName,
        emergencyContactPhone: input.emergencyContactPhone,
        employeeCode: input.employeeCode,
        position: input.position,
        department: input.department,
        hireDate: input.hireDate,
        confirmationDate: input.confirmationDate,
        probationEnd: input.probationEnd,
        employmentType: input.employmentType,
        contractEndDate: input.contractEndDate,
        bankJsonEncrypted: input.bankDetails
          ? encrypt(JSON.stringify(input.bankDetails))
          : undefined,
        cpfAccountNumber: input.cpfAccountNumber,
        workPassType: input.workPassType,
        workPassExpiry: input.workPassExpiry,
        taxRefNumber: input.taxRefNumber,
      })
      .returning({ id: employees.id, fullName: employees.fullName });

    await logAudit({
      userId: session.id,
      action: "create_employee",
      entityType: "employee",
      entityId: newEmployee?.id,
      newValue: {
        fullName: input.fullName,
        position: input.position,
        department: input.department,
      },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({ success: true, data: newEmployee } satisfies ApiResponse, {
      status: 201,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
