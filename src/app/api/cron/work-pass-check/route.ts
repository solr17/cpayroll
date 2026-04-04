import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, companies, users } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { nowSG, formatDateISO } from "@/lib/utils/date";
import { sendEmail } from "@/lib/email/mailer";
import { workPassExpiryEmail } from "@/lib/email/templates";
import type { ApiResponse } from "@/types";

/**
 * POST /api/cron/work-pass-check
 *
 * Cron-triggered endpoint to check all foreign workers across all companies
 * for expiring or expired work passes. Sends a digest email to company owners.
 *
 * Protected by CRON_SECRET env var — expected in Authorization: Bearer header.
 * Designed to be called by Vercel Cron or similar scheduler.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { success: false, error: "CRON_SECRET not configured" } satisfies ApiResponse,
        { status: 500 },
      );
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" } satisfies ApiResponse, {
        status: 401,
      });
    }

    const today = formatDateISO(nowSG());
    const ninetyDaysFromNow = new Date(nowSG());
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    const cutoffDate = formatDateISO(ninetyDaysFromNow);

    // Get all companies
    const allCompanies = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies);

    let totalAlertsSent = 0;

    for (const company of allCompanies) {
      // Find foreign workers with expiring/expired passes for this company
      const foreignWorkers = await db
        .select({
          fullName: employees.fullName,
          workPassType: employees.workPassType,
          workPassExpiry: employees.workPassExpiry,
        })
        .from(employees)
        .where(
          and(
            eq(employees.companyId, company.id),
            eq(employees.citizenshipStatus, "FW"),
            inArray(employees.status, ["active", "probation"]),
            sql`${employees.workPassExpiry} IS NOT NULL`,
            sql`${employees.workPassExpiry} <= ${cutoffDate}`,
          ),
        );

      if (foreignWorkers.length === 0) continue;

      // Find company owner(s) to notify
      const owners = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(and(eq(users.companyId, company.id), eq(users.role, "owner")));

      if (owners.length === 0) continue;

      // Build employee list for the email
      const alertEmployees = foreignWorkers
        .filter(
          (fw: { workPassExpiry: string | null; workPassType: string | null }) =>
            fw.workPassExpiry && fw.workPassType,
        )
        .map(
          (fw: {
            fullName: string;
            workPassType: string | null;
            workPassExpiry: string | null;
          }) => ({
            name: fw.fullName,
            passType: fw.workPassType!,
            expiryDate: fw.workPassExpiry!,
          }),
        )
        .sort((a: { expiryDate: string }, b: { expiryDate: string }) =>
          a.expiryDate.localeCompare(b.expiryDate),
        );

      if (alertEmployees.length === 0) continue;

      // Send digest email to each owner
      for (const owner of owners) {
        const { subject, html } = workPassExpiryEmail(owner.name, alertEmployees);
        await sendEmail(owner.email, subject, html);
        totalAlertsSent++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        companiesChecked: allCompanies.length,
        alertEmailsSent: totalAlertsSent,
        checkedAt: today,
      },
    } satisfies ApiResponse);
  } catch (err) {
    console.error("[cron/work-pass-check] Error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      } satisfies ApiResponse,
      { status: 500 },
    );
  }
}
