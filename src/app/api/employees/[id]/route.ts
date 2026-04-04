import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { updateEmployeeSchema } from "@/lib/validators/employee";
import { encrypt, decrypt } from "@/lib/crypto/aes";
import { logAudit } from "@/lib/audit/log";
import { dispatchWebhook } from "@/lib/webhooks/dispatch";
import { maskNric } from "@/lib/crypto/nric";
import type { ApiResponse, BankDetails } from "@/types";

/** GET /api/employees/:id — Get employee detail */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;

    const [employee] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.id, id), eq(employees.companyId, session.companyId)))
      .limit(1);

    if (!employee) {
      return NextResponse.json(
        { success: false, error: "Employee not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    // Decrypt PII for authorized users, mask NRIC
    const decrypted = {
      ...employee,
      nricFinHash: undefined, // Never expose hash
      nricDisplay: maskNric(employee.nricLast4),
      address: employee.addressEncrypted ? decrypt(employee.addressEncrypted) : null,
      addressEncrypted: undefined,
      bankDetails: employee.bankJsonEncrypted
        ? (JSON.parse(decrypt(employee.bankJsonEncrypted)) as BankDetails)
        : null,
      bankJsonEncrypted: undefined,
    };

    return NextResponse.json({ success: true, data: decrypted } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}

/** PATCH /api/employees/:id — Update employee */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("owner", "admin");
    const { id } = await params;
    const body = await request.json();
    const parsed = updateEmployeeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Validation failed",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Get current values for audit log
    const [current] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.id, id), eq(employees.companyId, session.companyId)))
      .limit(1);

    if (!current) {
      return NextResponse.json(
        { success: false, error: "Employee not found" } satisfies ApiResponse,
        { status: 404 },
      );
    }

    const input = parsed.data;
    const updateData: Record<string, unknown> = {};

    // Map input fields to DB columns, encrypt PII
    if (input.fullName !== undefined) updateData.fullName = input.fullName;
    if (input.dob !== undefined) updateData.dob = input.dob;
    if (input.gender !== undefined) updateData.gender = input.gender;
    if (input.nationality !== undefined) updateData.nationality = input.nationality;
    if (input.citizenshipStatus !== undefined)
      updateData.citizenshipStatus = input.citizenshipStatus;
    if (input.prEffectiveDate !== undefined) updateData.prEffectiveDate = input.prEffectiveDate;
    if (input.mobile !== undefined) updateData.mobile = input.mobile;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.address !== undefined) updateData.addressEncrypted = encrypt(input.address);
    if (input.emergencyContactName !== undefined)
      updateData.emergencyContactName = input.emergencyContactName;
    if (input.emergencyContactPhone !== undefined)
      updateData.emergencyContactPhone = input.emergencyContactPhone;
    if (input.employeeCode !== undefined) updateData.employeeCode = input.employeeCode;
    if (input.position !== undefined) updateData.position = input.position;
    if (input.department !== undefined) updateData.department = input.department;
    if (input.hireDate !== undefined) updateData.hireDate = input.hireDate;
    if (input.confirmationDate !== undefined) updateData.confirmationDate = input.confirmationDate;
    if (input.probationEnd !== undefined) updateData.probationEnd = input.probationEnd;
    if (input.employmentType !== undefined) updateData.employmentType = input.employmentType;
    if (input.contractEndDate !== undefined) updateData.contractEndDate = input.contractEndDate;
    if (input.bankDetails !== undefined)
      updateData.bankJsonEncrypted = encrypt(JSON.stringify(input.bankDetails));
    if (input.cpfAccountNumber !== undefined) updateData.cpfAccountNumber = input.cpfAccountNumber;
    if (input.workPassType !== undefined) updateData.workPassType = input.workPassType;
    if (input.workPassExpiry !== undefined) updateData.workPassExpiry = input.workPassExpiry;
    if (input.taxRefNumber !== undefined) updateData.taxRefNumber = input.taxRefNumber;

    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(employees)
      .set(updateData)
      .where(and(eq(employees.id, id), eq(employees.companyId, session.companyId)))
      .returning({ id: employees.id, fullName: employees.fullName });

    // Audit log — only log non-PII field names that changed
    const changedFields = Object.keys(input).filter((k) => k !== "bankDetails" && k !== "address");

    await logAudit({
      userId: session.id,
      action: "update_employee",
      entityType: "employee",
      entityId: id,
      oldValue: { changedFields },
      newValue: {
        changedFields,
        values: Object.fromEntries(
          changedFields.map((k) => [k, (input as Record<string, unknown>)[k]]),
        ),
      },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    // Fire-and-forget webhook dispatch
    dispatchWebhook(session.companyId, "employee.updated", {
      employeeId: id,
      changedFields,
    }).catch(() => {});

    return NextResponse.json({ success: true, data: updated } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
