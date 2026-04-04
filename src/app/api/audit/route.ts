import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import type { ApiResponse } from "@/types";

/** Keys whose values must be stripped from oldValue/newValue before returning */
const SENSITIVE_KEYS = ["password", "secret", "encrypted", "token", "nric", "nric_hash"];

/**
 * Recursively strip sensitive keys from a JSON value.
 * Returns a shallow-cleaned copy — never mutates the original.
 */
function stripSensitive(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(stripSensitive);
  if (typeof obj === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEYS.some((s) => lower.includes(s))) {
        cleaned[key] = "[REDACTED]";
      } else {
        cleaned[key] = stripSensitive(value);
      }
    }
    return cleaned;
  }
  return obj;
}

/** GET /api/audit — Query audit log with filters. Owner/admin only. */
export async function GET(request: NextRequest) {
  try {
    await requireRole("owner", "admin");
    const { searchParams } = new URL(request.url);

    const action = searchParams.get("action");
    const userId = searchParams.get("userId");
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));

    // Build dynamic where conditions
    const conditions = [];
    if (action) conditions.push(eq(auditLog.action, action));
    if (userId) conditions.push(eq(auditLog.userId, userId));
    if (entityType) conditions.push(eq(auditLog.entityType, entityType));
    if (entityId) conditions.push(eq(auditLog.entityId, entityId));
    if (from) conditions.push(gte(auditLog.createdAt, new Date(from)));
    if (to) conditions.push(lte(auditLog.createdAt, new Date(to)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total matching rows
    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(auditLog)
      .where(whereClause);
    const total = Number(countResult?.count ?? 0);
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    // Fetch page of entries
    const entries = await db
      .select()
      .from(auditLog)
      .where(whereClause)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    // Strip sensitive data from oldValue/newValue
    const sanitised = entries.map((entry: Record<string, unknown>) => ({
      ...entry,
      oldValue: stripSensitive(entry.oldValue),
      newValue: stripSensitive(entry.newValue),
    }));

    return NextResponse.json({
      success: true,
      data: {
        entries: sanitised,
        total,
        page,
        totalPages,
      },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
