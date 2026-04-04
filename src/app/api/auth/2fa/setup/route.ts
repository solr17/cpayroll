import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { generateTotpSecret, generateTotpUri } from "@/lib/auth/totp";
import { logAudit } from "@/lib/audit/log";
import type { ApiResponse } from "@/types";

/** POST /api/auth/2fa/setup — Generate TOTP secret for the current user */
export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" } satisfies ApiResponse, {
        status: 401,
      });
    }

    const secret = generateTotpSecret();
    const uri = generateTotpUri(secret, session.email, "ClinicPay");

    // Store secret (not yet enabled — user must verify first)
    await db
      .update(users)
      .set({ totpSecret: secret, updatedAt: new Date() })
      .where(eq(users.id, session.id));

    await logAudit({
      userId: session.id,
      action: "2fa_setup_initiated",
      entityType: "user",
      entityId: session.id,
    });

    return NextResponse.json({
      success: true,
      data: { secret, uri },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, {
      status: 500,
    });
  }
}
