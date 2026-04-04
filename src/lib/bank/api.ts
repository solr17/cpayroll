/**
 * Bank API abstraction layer.
 *
 * Provides a generic interface so multiple bank integrations (DBS, OCBC, UOB)
 * can be swapped in without changing calling code.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaymentItem {
  beneficiaryName: string;
  beneficiaryAccount: string;
  bankCode: string;
  branchCode: string;
  /** Net pay in integer cents — converted to dollars only at the API boundary */
  amountCents: number;
  /** Unique reference for this payment line (e.g. SAL-2026-03-1234) */
  reference: string;
  /** Human-readable description shown on bank statement */
  description?: string;
}

export interface PaymentBatch {
  /** Caller-generated batch reference (e.g. PR-<payRunId short>) */
  reference: string;
  /** Company debit account number */
  debitAccount: string;
  /** Individual payment items */
  payments: PaymentItem[];
}

export type PaymentStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export interface PaymentResultItem {
  reference: string;
  status: PaymentStatus;
  bankReference?: string;
  failureReason?: string;
}

export interface PaymentResult {
  batchId: string;
  status: PaymentStatus;
  transactionReference: string;
  payments: PaymentResultItem[];
}

// ---------------------------------------------------------------------------
// Abstract client
// ---------------------------------------------------------------------------

export interface BankApiClient {
  /** Human-readable bank name */
  readonly name: string;

  /** Submit a batch payment via the bank API */
  submitPayment(batch: PaymentBatch): Promise<PaymentResult>;

  /** Query the status of a previously submitted batch */
  getStatus(batchId: string): Promise<PaymentResult>;

  /** Cancel a pending/processing batch */
  cancelPayment(batchId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Get a BankApiClient for the given bank, if one is available and configured.
 *
 * Returns `null` when:
 *  - The bank has no API integration yet (e.g. OCBC, UOB — future)
 *  - Required env vars are missing
 */
export function getBankApiClient(bankName: string): BankApiClient | null {
  const normalised = bankName.toUpperCase().trim();

  switch (normalised) {
    case "DBS":
    case "POSB": {
      // Lazy-import to avoid pulling DBS deps when not needed
      const clientId = process.env.DBS_RAPID_CLIENT_ID;
      if (!clientId) return null;

      // Dynamic require avoided — use the pre-built singleton from dbs-rapid
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { dbsRapidClient } = require("./dbs-rapid") as {
        dbsRapidClient: BankApiClient;
      };
      return dbsRapidClient;
    }

    // Future: case "OCBC": ...
    // Future: case "UOB": ...

    default:
      return null;
  }
}

/**
 * Check whether direct bank API payment is available for any bank.
 * Useful for UI to show/hide the "Pay via API" button.
 */
export function isBankApiAvailable(): boolean {
  return !!process.env.DBS_RAPID_CLIENT_ID;
}
