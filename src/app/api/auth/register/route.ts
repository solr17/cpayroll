import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit/log";
import { createSessionToken } from "@/lib/auth/session-token";
import { generateCsrfToken } from "@/lib/security/csrf";
import { seedDefaultPayItems } from "@/lib/db/seed-pay-items";
import { seedDefaultGlAccounts } from "@/lib/db/seed-gl-accounts";
import { seedPublicHolidays } from "@/lib/db/seed-holidays";
import { sendEmail } from "@/lib/email/mailer";
import { welcomeEmail } from "@/lib/email/templates";
import logger from "@/lib/logger";
import { z } from "zod";

/**
 * UEN format: 9-10 alphanumeric characters.
 * Examples: 200012345A, T08FC1234A, 53456789M
 */
const uenPattern = /^[A-Za-z0-9]{9,10}$/;

const registerSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(200),
  uen: z.string().regex(uenPattern, "UEN must be 9-10 alphanumeric characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").max(200),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message ?? "Invalid input";
      return NextResponse.json({ success: false, error: firstError }, { status: 400 });
    }

    const { companyName, uen, email, password, name } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUen = uen.toUpperCase().trim();

    // Rate limiting by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { checkRateLimit } = await import("@/lib/security/rate-limit");
    const rateCheck = await checkRateLimit(`register:${ip}`, 3, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many registration attempts. Please try again later.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)) },
        },
      );
    }

    // Check email uniqueness
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    // Check UEN uniqueness
    const [existingCompany] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.uen, normalizedUen))
      .limit(1);

    if (existingCompany) {
      return NextResponse.json(
        { success: false, error: "A company with this UEN is already registered" },
        { status: 409 },
      );
    }

    // Create company
    const [company] = await db
      .insert(companies)
      .values({
        name: companyName.trim(),
        uen: normalizedUen,
      })
      .returning({ id: companies.id });

    // Hash password (12 rounds)
    const passwordHash = await bcrypt.hash(password, 12);

    // Create owner user
    const [user] = await db
      .insert(users)
      .values({
        companyId: company.id,
        email: normalizedEmail,
        passwordHash,
        name: name.trim(),
        role: "owner",
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
      });

    // Seed default data for the new company (non-blocking errors)
    try {
      await seedDefaultPayItems(company.id);
    } catch (err) {
      logger.error({ err: err instanceof Error ? err : String(err) }, "Failed to seed pay items");
    }

    try {
      await seedDefaultGlAccounts(company.id);
    } catch (err) {
      logger.error({ err: err instanceof Error ? err : String(err) }, "Failed to seed GL accounts");
    }

    try {
      const currentYear = new Date().getFullYear();
      await seedPublicHolidays(currentYear);
    } catch (err) {
      logger.error({ err: err instanceof Error ? err : String(err) }, "Failed to seed holidays");
    }

    // Send welcome email (non-blocking — registration succeeds even if email fails)
    const template = welcomeEmail(user.name, companyName.trim());
    sendEmail(user.email, template.subject, template.html).catch((err) =>
      logger.error({ err: err instanceof Error ? err : String(err) }, "Welcome email failed"),
    );

    // Create session token
    const sessionToken = createSessionToken(user.id, user.role, company.id);

    // Audit log
    await logAudit({
      userId: user.id,
      action: "register",
      entityType: "company",
      entityId: company.id,
      newValue: { companyName: companyName.trim(), uen: normalizedUen, email: normalizedEmail },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    const response = NextResponse.json({
      success: true,
      data: { id: user.id, email: user.email, name: user.name, role: user.role },
    });

    // Set session cookie
    response.cookies.set("session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/",
    });

    // Set CSRF token cookie
    response.cookies.set("csrf_token", generateCsrfToken(sessionToken), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });

    return response;
  } catch (err) {
    logger.error({ err: err instanceof Error ? err : String(err) }, "Registration failed");
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
