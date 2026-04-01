import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

interface AuditEntry {
  userId?: string | undefined;
  action: string;
  entityType: string;
  entityId?: string | undefined;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

/**
 * Log an audit entry. APPEND-ONLY — this function only INSERTs.
 * No UPDATE or DELETE operations exist for audit_log.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
  });
}
