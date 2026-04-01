import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/types";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
}

/**
 * Get current session user from cookie.
 * Simple session token approach for MVP — upgrade to NextAuth in production.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;
  if (!sessionToken) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(sessionToken, "base64").toString("utf-8"),
    ) as { userId: string };

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        companyId: users.companyId,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user) return null;
    return user as SessionUser;
  } catch {
    return null;
  }
}

/**
 * Require specific role(s). Throws if unauthorized.
 */
export async function requireRole(...allowedRoles: UserRole[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized: not logged in");
  }
  if (!allowedRoles.includes(session.role)) {
    throw new Error(`Unauthorized: requires ${allowedRoles.join(" or ")} role`);
  }
  return session;
}
