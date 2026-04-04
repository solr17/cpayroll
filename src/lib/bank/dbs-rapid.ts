/**
 * DBS RAPID API client for programmatic GIRO payments.
 *
 * Sandbox: https://www.dbs.com/developers
 * Production: requires formal DBS RAPID partnership agreement
 *
 * Environment variables:
 *   DBS_RAPID_CLIENT_ID      — OAuth2 client ID
 *   DBS_RAPID_CLIENT_SECRET  — OAuth2 client secret
 *   DBS_RAPID_BASE_URL       — sandbox: https://www.dbs.com/sandbox  |  production URL
 *   DBS_RAPID_DEBIT_ACCOUNT  — company's DBS account for debiting
 */

import type {
  BankApiClient,
  PaymentBatch,
  PaymentResult,
  PaymentStatus,
  PaymentResultItem,
} from "./api";

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getConfig() {
  const clientId = process.env.DBS_RAPID_CLIENT_ID;
  const clientSecret = process.env.DBS_RAPID_CLIENT_SECRET;
  const baseUrl = process.env.DBS_RAPID_BASE_URL ?? "https://www.dbs.com/sandbox";

  if (!clientId || !clientSecret) {
    throw new Error(
      "DBS RAPID API not configured: DBS_RAPID_CLIENT_ID and DBS_RAPID_CLIENT_SECRET are required",
    );
  }

  return { clientId, clientSecret, baseUrl: baseUrl.replace(/\/+$/, "") };
}

/** Mask an account number for safe logging: 012345678 → ****5678 */
function maskAccount(account: string): string {
  if (account.length <= 4) return "****";
  return "****" + account.slice(-4);
}

// ---------------------------------------------------------------------------
// DBS API request/response shapes
// ---------------------------------------------------------------------------

interface DbsTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface DbsPaymentRequest {
  batchReference: string;
  debitAccount: string;
  payments: {
    beneficiaryName: string;
    beneficiaryAccount: string;
    bankCode: string;
    branchCode: string;
    amount: string; // dollars with 2 decimals
    reference: string;
    description: string;
  }[];
}

interface DbsPaymentItemResponse {
  reference: string;
  status: string;
  bankReference?: string;
  failureReason?: string;
}

interface DbsPaymentResponse {
  batchId: string;
  status: "accepted" | "rejected" | "pending" | "processing" | "completed" | "failed" | "cancelled";
  transactionReference: string;
  payments: DbsPaymentItemResponse[];
}

// ---------------------------------------------------------------------------
// Token cache
// ---------------------------------------------------------------------------

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Obtain an OAuth2 access token via client_credentials grant.
 * Caches the token and refreshes 60 s before expiry.
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const { clientId, clientSecret, baseUrl } = getConfig();

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetchWithTimeout(`${baseUrl}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DBS OAuth2 token request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as DbsTokenResponse;
  cachedToken = data.access_token;
  // Refresh 60 s before actual expiry (tokens typically last 1800 s / 30 min)
  tokenExpiresAt = now + (data.expires_in - 60) * 1000;

  return cachedToken;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Make an authenticated request to the DBS RAPID API.
 * Retries once on 5xx errors.
 */
async function dbsRequest(method: string, path: string, body?: unknown): Promise<Response> {
  const { baseUrl } = getConfig();
  const url = `${baseUrl}${path}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const token = await getAccessToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const res = await fetchWithTimeout(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    // Retry on 5xx
    if (res.status >= 500 && attempt < MAX_RETRIES) {
      lastError = new Error(`DBS API ${method} ${path} returned ${res.status}`);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DBS API ${method} ${path} failed (${res.status}): ${text}`);
    }

    return res;
  }

  throw lastError ?? new Error("DBS API request failed after retries");
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

function mapDbsStatus(dbsStatus: string): PaymentStatus {
  switch (dbsStatus.toLowerCase()) {
    case "accepted":
    case "pending":
      return "pending";
    case "processing":
      return "processing";
    case "completed":
      return "completed";
    case "rejected":
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

function mapDbsPaymentItems(items: DbsPaymentItemResponse[]): PaymentResultItem[] {
  return items.map((item) => {
    const result: PaymentResultItem = {
      reference: item.reference,
      status: mapDbsStatus(item.status),
    };
    if (item.bankReference !== undefined) result.bankReference = item.bankReference;
    if (item.failureReason !== undefined) result.failureReason = item.failureReason;
    return result;
  });
}

// ---------------------------------------------------------------------------
// Client implementation
// ---------------------------------------------------------------------------

class DbsRapidApiClient implements BankApiClient {
  readonly name = "DBS RAPID";

  async submitPayment(batch: PaymentBatch): Promise<PaymentResult> {
    if (batch.payments.length === 0) {
      throw new Error("Cannot submit empty payment batch");
    }

    const requestBody: DbsPaymentRequest = {
      batchReference: batch.reference,
      debitAccount: batch.debitAccount,
      payments: batch.payments.map((p) => ({
        beneficiaryName: p.beneficiaryName,
        beneficiaryAccount: p.beneficiaryAccount,
        bankCode: p.bankCode,
        branchCode: p.branchCode,
        // Convert integer cents to dollar string with 2 decimal places
        amount: (p.amountCents / 100).toFixed(2),
        reference: p.reference,
        description: p.description ?? `Salary payment ${p.reference}`,
      })),
    };

    // Log safely — never log full account numbers
    console.info(
      `[DBS RAPID] Submitting batch ${batch.reference} with ${batch.payments.length} payments, debit account ${maskAccount(batch.debitAccount)}`,
    );

    const res = await dbsRequest("POST", "/rapid/v1/payments/batch", requestBody);
    const data = (await res.json()) as DbsPaymentResponse;

    return {
      batchId: data.batchId,
      status: mapDbsStatus(data.status),
      transactionReference: data.transactionReference,
      payments: mapDbsPaymentItems(data.payments),
    };
  }

  async getStatus(batchId: string): Promise<PaymentResult> {
    console.info(`[DBS RAPID] Checking status for batch ${batchId}`);

    const res = await dbsRequest("GET", `/rapid/v1/payments/batch/${encodeURIComponent(batchId)}`);
    const data = (await res.json()) as DbsPaymentResponse;

    return {
      batchId: data.batchId,
      status: mapDbsStatus(data.status),
      transactionReference: data.transactionReference,
      payments: mapDbsPaymentItems(data.payments),
    };
  }

  async cancelPayment(batchId: string): Promise<void> {
    console.info(`[DBS RAPID] Cancelling batch ${batchId}`);
    await dbsRequest("DELETE", `/rapid/v1/payments/batch/${encodeURIComponent(batchId)}`);
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const dbsRapidClient: BankApiClient = new DbsRapidApiClient();

/**
 * Test the DBS RAPID API connection.
 * Returns true if auth succeeds, false otherwise.
 */
export async function testDbsConnection(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch {
    return false;
  }
}

/** Clear the cached token (useful for tests or after credential rotation). */
export function clearTokenCache(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}
