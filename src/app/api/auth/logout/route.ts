import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit/log";
import { verifySessionToken } from "@/lib/auth/session-token";

/**
 * POST /api/auth/logout — Clear session cookie and log the event.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("session_token")?.value;

    if (sessionToken) {
      const payload = verifySessionToken(sessionToken);
      if (payload) {
        await logAudit({
          userId: payload.userId,
          action: "logout",
          entityType: "user",
          entityId: payload.userId,
          ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
          userAgent: request.headers.get("user-agent") ?? undefined,
        });
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set("session_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    response.cookies.set("csrf_token", "", { path: "/", maxAge: 0 });
    return response;
  } catch {
    // Even on error, clear the cookies
    const response = NextResponse.json({ success: true });
    response.cookies.set("session_token", "", { path: "/", maxAge: 0 });
    response.cookies.set("csrf_token", "", { path: "/", maxAge: 0 });
    return response;
  }
}
