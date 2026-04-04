import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/totp";
import { logAudit } from "@/lib/audit/log";
import { generateBackupCodes, hashBackupCode } from "@/lib/auth/backup-codes";
import { z } from "zod";
import type { ApiResponse } from "@/types";

const verifySchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
  action: z.enum(["enable", "disable"]).optional().default("enable"),
});

/** POST /api/auth/2fa/verify — Verify TOTP code to enable/disable 2FA */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" } satisfies ApiResponse, {
        status: 401,
      });
    }

    const body = await request.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message ?? "Invalid input",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const { code, action } = parsed.data;

    // Get user's TOTP secret
    const [user] = await db
      .select({ totpSecret: users.totpSecret, totpEnabled: users.totpEnabled })
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);

    if (!user?.totpSecret) {
      return NextResponse.json(
        {
          success: false,
          error: "2FA not set up. Please initiate setup first.",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const valid = verifyTotp(user.totpSecret, code);
    if (!valid) {
      return NextResponse.json(
        { success: false, error: "Invalid verification code" } satisfies ApiResponse,
        { status: 400 },
      );
    }

    if (action === "enable") {
      // Generate 10 one-time backup codes
      const plaintextCodes = generateBackupCodes(10);
      const hashedCodes = plaintextCodes.map(hashBackupCode);

      await db
        .update(users)
        .set({
          totpEnabled: "true",
          backupCodes: JSON.stringify(hashedCodes),
          updatedAt: new Date(),
        })
        .where(eq(users.id, session.id));

      await logAudit({
        userId: session.id,
        action: "2fa_enabled",
        entityType: "user",
        entityId: session.id,
      });

      return NextResponse.json({
        success: true,
        data: { totpEnabled: true, backupCodes: plaintextCodes },
      } satisfies ApiResponse);
    } else {
      // Disable 2FA — clear secret and backup codes
      await db
        .update(users)
        .set({
          totpEnabled: "false",
          totpSecret: null,
          backupCodes: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, session.id));

      await logAudit({
        userId: session.id,
        action: "2fa_disabled",
        entityType: "user",
        entityId: session.id,
      });

      return NextResponse.json({
        success: true,
        data: { totpEnabled: false },
      } satisfies ApiResponse);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, {
      status: 500,
    });
  }
}
