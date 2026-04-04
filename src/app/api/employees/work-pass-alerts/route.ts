import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { nowSG, formatDateISO } from "@/lib/utils/date";
import type { ApiResponse } from "@/types";

interface WorkPassEmployee {
  id: string;
  fullName: string;
  nricLast4: string;
  workPassType: string;
  workPassExpiry: string;
  department: string | null;
}

interface WorkPassAlertData {
  expiring: WorkPassEmployee[];
  expired: WorkPassEmployee[];
}

/** GET /api/employees/work-pass-alerts — Foreign workers with expiring/expired work passes */
export async function GET() {
  try {
    const session = await requireRole("owner", "admin", "payroll_operator");
    const companyId = session.companyId;

    const today = formatDateISO(nowSG());

    // 90 days from today
    const ninetyDaysFromNow = new Date(nowSG());
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    const cutoffDate = formatDateISO(ninetyDaysFromNow);

    // Fetch all non-terminated foreign workers with work pass expiry set
    const foreignWorkers = await db
      .select({
        id: employees.id,
        fullName: employees.fullName,
        nricLast4: employees.nricLast4,
        workPassType: employees.workPassType,
        workPassExpiry: employees.workPassExpiry,
        department: employees.department,
      })
      .from(employees)
      .where(
        and(
          eq(employees.companyId, companyId),
          eq(employees.citizenshipStatus, "FW"),
          inArray(employees.status, ["active", "probation"]),
          sql`${employees.workPassExpiry} IS NOT NULL`,
          sql`${employees.workPassExpiry} <= ${cutoffDate}`,
        ),
      );

    const expired: WorkPassEmployee[] = [];
    const expiring: WorkPassEmployee[] = [];

    for (const fw of foreignWorkers) {
      if (!fw.workPassExpiry || !fw.workPassType) continue;

      const entry: WorkPassEmployee = {
        id: fw.id,
        fullName: fw.fullName,
        nricLast4: fw.nricLast4,
        workPassType: fw.workPassType,
        workPassExpiry: fw.workPassExpiry,
        department: fw.department,
      };

      if (fw.workPassExpiry < today) {
        expired.push(entry);
      } else {
        expiring.push(entry);
      }
    }

    // Sort by expiry date ascending (most urgent first)
    expired.sort((a, b) => a.workPassExpiry.localeCompare(b.workPassExpiry));
    expiring.sort((a, b) => a.workPassExpiry.localeCompare(b.workPassExpiry));

    return NextResponse.json({
      success: true,
      data: { expiring, expired } satisfies WorkPassAlertData,
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
