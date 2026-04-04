import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifySessionToken } from "./session-token";
import type { UserRole } from "@/types";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
}

/**
 * Role-based permissions map.
 * owner gets wildcard '*' (everything).
 */
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: ["*"],
  admin: ["employees", "payroll", "reports", "settings", "pay_items", "gl"],
  payroll_operator: ["employees.read", "payroll.write", "payroll.read", "reports.read"],
  report_viewer: ["employees.read", "reports.read"],
  employee: ["self.read"],
};

/**
 * Check if a role has a specific permission.
 * Supports wildcard '*' for owner and dotted sub-permissions.
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;

  if (perms.includes("*")) return true;
  if (perms.includes(permission)) return true;

  const parentPerm = permission.split(".")[0];
  if (parentPerm && perms.includes(parentPerm)) return true;

  return false;
}

/**
 * Get current session user from signed cookie.
 * Verifies HMAC signature and expiry before querying DB.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;
  if (!sessionToken) return null;

  try {
    const payload = verifySessionToken(sessionToken);
    if (!payload) return null;

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
