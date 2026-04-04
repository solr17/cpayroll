import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { leaveBalances, employees } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { initializeBalances } from "@/lib/leave/accrual";
import type { ApiResponse } from "@/types";

/** GET /api/leave/balances — Get leave balances for an employee or all employees */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: not logged in" } satisfies ApiResponse,
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { success: false, error: "Invalid year parameter" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    if (employeeId) {
      // Initialize balances for this employee if they don't exist yet
      try {
        await initializeBalances(employeeId, session.companyId, year);
      } catch {
        // Employee may not exist — will return empty balances
      }

      const balances = await db
        .select()
        .from(leaveBalances)
        .where(and(eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.year, year)));

      return NextResponse.json({ success: true, data: balances } satisfies ApiResponse);
    }

    // Admin: get balances for all employees in the company
    const isAdmin = ["owner", "admin", "payroll_operator"].includes(session.role);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: insufficient role" } satisfies ApiResponse,
        { status: 403 },
      );
    }

    // Get all active employees for this company
    const companyEmployees = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.companyId, session.companyId));

    // Initialize balances for all employees
    for (const emp of companyEmployees) {
      try {
        await initializeBalances(emp.id, session.companyId, year);
      } catch {
        // Skip employees with issues
      }
    }

    const balances = await db
      .select()
      .from(leaveBalances)
      .where(eq(leaveBalances.year, year))
      .innerJoin(
        employees,
        and(eq(employees.id, leaveBalances.employeeId), eq(employees.companyId, session.companyId)),
      );

    // Reshape: group by employee
    const grouped: Record<string, { employeeId: string; balances: typeof balances }> = {};
    for (const row of balances) {
      const empId = row.leave_balances.employeeId;
      if (!grouped[empId]) {
        grouped[empId] = { employeeId: empId, balances: [] };
      }
      grouped[empId].balances.push(row);
    }

    return NextResponse.json({
      success: true,
      data: Object.values(grouped),
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
