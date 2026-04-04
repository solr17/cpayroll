import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyTotp } from "@/lib/auth/totp";
import { verifyBackupCode } from "@/lib/auth/backup-codes";
import { logAudit } from "@/lib/audit/log";
import { createSessionToken } from "@/lib/auth/session-token";
import { generateCsrfToken } from "@/lib/security/csrf";
import { createHmac } from "crypto";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const checkSchema = z.object({
  twoFaToken: z.string().min(1, "Token required"),
  code: z.string().min(6).max(9, "Invalid code format"),
});

/** Verify and extract userId from the signed 2FA token */
function verifyTwoFaToken(token: string): string | null {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;

    const secret = process.env.NEXTAUTH_SECRET || "clinicpay-2fa-secret";
    const expectedSig = createHmac("sha256", secret)
      .update(Buffer.from(payloadB64, "base64url").toString())
      .digest("hex");

    if (sig !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (payload.exp < Date.now()) return null;

    return payload.userId;
  } catch {
    return null;
  }
}

/** POST /api/auth/2fa/check — Verify TOTP during login flow */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = checkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message ?? "Invalid input",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const { twoFaToken, code } = parsed.data;

    const userId = verifyTwoFaToken(twoFaToken);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" } satisfies ApiResponse,
        { status: 401 },
      );
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        companyId: users.companyId,
        totpSecret: users.totpSecret,
        totpEnabled: users.totpEnabled,
        backupCodes: users.backupCodes,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || user.totpEnabled !== "true" || !user.totpSecret) {
      return NextResponse.json({ success: false, error: "Invalid request" } satisfies ApiResponse, {
        status: 400,
      });
    }

    // Determine if the code is a backup code (XXXX-XXXX, 9 chars) or TOTP (6 digits)
    const isBackupCode = code.length === 9 && code[4] === "-";
    let auditAction = "login_2fa";

    if (isBackupCode) {
      // Verify against stored hashed backup codes
      const storedHashes: string[] = user.backupCodes ? JSON.parse(user.backupCodes) : [];
      const { valid, remaining } = verifyBackupCode(code, storedHashes);

      if (!valid) {
        return NextResponse.json(
          { success: false, error: "Invalid 2FA code" } satisfies ApiResponse,
          { status: 401 },
        );
      }

      // Remove the used backup code (one-time use)
      await db
        .update(users)
        .set({ backupCodes: JSON.stringify(remaining), updatedAt: new Date() })
        .where(eq(users.id, user.id));

      auditAction = "login_2fa_backup";
    } else {
      // Standard TOTP verification
      const valid = verifyTotp(user.totpSecret, code);
      if (!valid) {
        return NextResponse.json(
          { success: false, error: "Invalid 2FA code" } satisfies ApiResponse,
          { status: 401 },
        );
      }
    }

    // Generate signed session token
    const sessionToken = createSessionToken(user.id, user.role, user.companyId);

    await logAudit({
      userId: user.id,
      action: auditAction,
      entityType: "user",
      entityId: user.id,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    const response = NextResponse.json({
      success: true,
      data: { id: user.id, email: user.email, name: user.name, role: user.role },
    } satisfies ApiResponse);

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
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, {
      status: 500,
    });
  }
}
