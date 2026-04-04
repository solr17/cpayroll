import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users, payslips, payRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  // Look up the employeeId linked to this user
  const [user] = await db
    .select({ employeeId: users.employeeId })
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);

  if (!user?.employeeId) {
    return NextResponse.json({
      success: true,
      data: [],
      message: "No employee record linked to this account",
    });
  }

  // Fetch payslips joined with pay runs for period info
  const rows = await db
    .select({
      id: payslips.id,
      periodStart: payRuns.periodStart,
      periodEnd: payRuns.periodEnd,
      payDate: payRuns.payDate,
      grossPayCents: payslips.grossPayCents,
      netPayCents: payslips.netPayCents,
      status: payRuns.status,
    })
    .from(payslips)
    .innerJoin(payRuns, eq(payslips.payRunId, payRuns.id))
    .where(eq(payslips.employeeId, user.employeeId))
    .orderBy(desc(payRuns.payDate));

  return NextResponse.json({ success: true, data: rows });
}
