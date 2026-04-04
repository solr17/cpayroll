import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { getBankApiClient } from "@/lib/bank/api";
import { logAudit } from "@/lib/audit/log";
import type { ApiResponse } from "@/types";
import type { PaymentStatus } from "@/lib/bank/api";

/**
 * Batch status entry — in a production system these would come from a
 * `payment_batches` database table. For the sandbox-ready MVP we accept
 * them in the request body so the caller (UI or cron) can pass the batch
 * IDs it already knows about.
 */
interface BatchStatusRequest {
  batches: {
    batchId: string;
    bank: string;
  }[];
}

interface BatchStatusResult {
  batchId: string;
  bank: string;
  previousStatus?: PaymentStatus;
  currentStatus: PaymentStatus;
  transactionReference: string;
  payments: {
    reference: string;
    status: PaymentStatus;
    bankReference?: string;
    failureReason?: string;
  }[];
}

/**
 * POST /api/payments/check-status
 *
 * Poll bank APIs for the latest status of submitted payment batches.
 * Designed to be called by:
 *  - A cron job (Vercel Cron / BullMQ)
 *  - Manual "Refresh Status" button in the UI
 *
 * Request body:
 * ```json
 * {
 *   "batches": [
 *     { "batchId": "...", "bank": "DBS" }
 *   ]
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole("owner", "admin");

    const body = (await request.json()) as BatchStatusRequest;

    if (!body.batches || !Array.isArray(body.batches) || body.batches.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Request body must include a non-empty 'batches' array with batchId and bank fields",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    // Cap at 50 batches per request to prevent abuse
    if (body.batches.length > 50) {
      return NextResponse.json(
        {
          success: false,
          error: "Maximum 50 batches per status check request",
        } satisfies ApiResponse,
        { status: 400 },
      );
    }

    const results: BatchStatusResult[] = [];
    const errors: { batchId: string; error: string }[] = [];

    for (const batch of body.batches) {
      if (!batch.batchId || !batch.bank) {
        errors.push({
          batchId: batch.batchId ?? "unknown",
          error: "Missing batchId or bank",
        });
        continue;
      }

      const client = getBankApiClient(batch.bank);
      if (!client) {
        errors.push({
          batchId: batch.batchId,
          error: `No API client available for bank: ${batch.bank}`,
        });
        continue;
      }

      try {
        const status = await client.getStatus(batch.batchId);

        results.push({
          batchId: batch.batchId,
          bank: batch.bank,
          currentStatus: status.status,
          transactionReference: status.transactionReference,
          payments: status.payments,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        // Sanitize any account numbers from error messages
        const safeMessage = message.replace(/\d{6,}/g, "****");
        errors.push({
          batchId: batch.batchId,
          error: safeMessage,
        });
      }
    }

    // Audit the status check
    await logAudit({
      userId: session.id,
      action: "payment_status_check",
      entityType: "payment_batch",
      newValue: {
        checkedCount: body.batches.length,
        successCount: results.length,
        errorCount: errors.length,
      },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        results,
        ...(errors.length > 0 && { errors }),
      },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message } satisfies ApiResponse, { status });
  }
}
