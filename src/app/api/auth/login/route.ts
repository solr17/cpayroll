import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit/log";
import { createSessionToken } from "@/lib/auth/session-token";
import { generateCsrfToken } from "@/lib/security/csrf";
import logger from "@/lib/logger";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password format" },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;

    // Rate limiting by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { checkRateLimit } = await import("@/lib/security/rate-limit");
    const rateCheck = await checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many login attempts. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)) },
        },
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
    }

    // Check if 2FA is enabled — return a temporary token instead of userId
    // to prevent user enumeration (attacker can't tell if account exists)
    if (user.totpEnabled === "true") {
      // Create a short-lived token for 2FA verification (5 min expiry)
      const { createHmac } = await import("crypto");
      const secret = process.env.NEXTAUTH_SECRET || "clinicpay-2fa-secret";
      const payload = JSON.stringify({ userId: user.id, exp: Date.now() + 5 * 60 * 1000 });
      const sig = createHmac("sha256", secret).update(payload).digest("hex");
      const twoFaToken = Buffer.from(payload).toString("base64url") + "." + sig;

      return NextResponse.json({
        success: true,
        requires2fa: true,
        twoFaToken,
      });
    }

    // Create HMAC-signed session token
    const sessionToken = createSessionToken(user.id, user.role, user.companyId);

    await logAudit({
      userId: user.id,
      action: "login",
      entityType: "user",
      entityId: user.id,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    const response = NextResponse.json({
      success: true,
      data: { id: user.id, email: user.email, name: user.name, role: user.role },
    });

    response.cookies.set("session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/",
    });

    // Set CSRF token cookie (readable by JS, validated by middleware)
    response.cookies.set("csrf_token", generateCsrfToken(sessionToken), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });

    return response;
  } catch (err) {
    logger.error({ err: err instanceof Error ? err : String(err) }, "Login failed");
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
