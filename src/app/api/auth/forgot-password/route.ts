import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createResetToken } from "@/lib/auth/reset-token";
import { logAudit } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sendEmail } from "@/lib/email/mailer";
import { passwordResetEmail } from "@/lib/email/templates";
import logger from "@/lib/logger";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    // Rate limit: 3 attempts per 15 minutes per IP
    const rateCheck = await checkRateLimit(`forgot-password:${ip}`, 3, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)) },
        },
      );
    }

    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid email format" }, { status: 400 });
    }

    const { email } = parsed.data;

    // Look up user — but ALWAYS return success to prevent email enumeration
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (user) {
      const token = createResetToken(user.id);
      const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${token}`;

      // Send password reset email (non-blocking; logs to console if SMTP not configured)
      const template = passwordResetEmail(user.name ?? "there", resetUrl);
      sendEmail(user.email, template.subject, template.html).catch((err) =>
        logger.error(
          { err: err instanceof Error ? err : String(err) },
          "Password reset email failed",
        ),
      );

      await logAudit({
        userId: user.id,
        action: "password_reset_requested",
        entityType: "user",
        entityId: user.id,
        ipAddress: ip,
        userAgent: request.headers.get("user-agent") ?? undefined,
      });
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account exists with that email, a reset link has been sent.",
    });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err : String(err) }, "Forgot password failed");
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
