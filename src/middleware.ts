import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { UserRole } from "@/types";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/register",
  "/api/auth/2fa/check",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/stripe/webhook",
  "/api/health",
  "/api/demo/seed",
  "/terms",
  "/privacy",
  "/pricing",
];

const ROUTE_ROLE_MAP: { pattern: string; roles: UserRole[] }[] = [
  { pattern: "/audit", roles: ["owner", "admin"] },
  { pattern: "/settings", roles: ["owner", "admin"] },
  { pattern: "/pay-items", roles: ["owner", "admin"] },
  { pattern: "/gl", roles: ["owner", "admin"] },
  { pattern: "/users", roles: ["owner", "admin"] },
  { pattern: "/billing", roles: ["owner", "admin"] },
  { pattern: "/employees/new", roles: ["owner", "admin"] },
  { pattern: "/employees/bulk", roles: ["owner", "admin"] },
  { pattern: "/employees", roles: ["owner", "admin", "payroll_operator", "report_viewer"] },
  { pattern: "/payroll", roles: ["owner", "admin", "payroll_operator"] },
  { pattern: "/reports", roles: ["owner", "admin", "payroll_operator", "report_viewer"] },
  { pattern: "/leave", roles: ["owner", "admin", "payroll_operator", "report_viewer", "employee"] },
  {
    pattern: "/my-payslips",
    roles: ["owner", "admin", "payroll_operator", "report_viewer", "employee"],
  },
  {
    pattern: "/security",
    roles: ["owner", "admin", "payroll_operator", "report_viewer", "employee"],
  },
  {
    pattern: "/dashboard",
    roles: ["owner", "admin", "payroll_operator", "report_viewer", "employee"],
  },
];

// --- Edge-compatible crypto helpers (Web Crypto API) ---

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64urlEncode(buf: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return base64urlEncode(new Uint8Array(signature));
}

interface SessionPayload {
  userId: string;
  role: string;
  companyId: string;
  iat: number;
  exp: number;
}

async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const payloadStr = parts[0];
    const providedSig = parts[1];
    if (!payloadStr || !providedSig) return null;

    const secret = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET || "";
    const expectedSig = await hmacSha256(secret, payloadStr);

    if (providedSig !== expectedSig) return null;

    const decoded = new TextDecoder().decode(base64urlDecode(payloadStr));
    const payload = JSON.parse(decoded) as SessionPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

async function validateCsrfToken(token: string, sessionToken: string): Promise<boolean> {
  try {
    const csrfSecret = process.env.CSRF_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
    const expected = await hmacSha256hex(csrfSecret, sessionToken);
    return token === expected;
  } catch {
    return false;
  }
}

async function hmacSha256hex(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Rate limiting (in-memory, best-effort for edge) ---

const apiRateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkApiRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 100;

  if (apiRateLimitStore.size > 5000) {
    for (const [key, entry] of apiRateLimitStore) {
      if (now >= entry.resetAt) apiRateLimitStore.delete(key);
    }
  }

  const entry = apiRateLimitStore.get(ip);
  if (!entry || now >= entry.resetAt) {
    apiRateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count += 1;
  if (entry.count > maxRequests) return false;
  return true;
}

// --- Middleware ---

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const response = NextResponse.next();
    addSecurityHeaders(response);
    return response;
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // API rate limiting
  if (pathname.startsWith("/api/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkApiRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
  }

  // Check for session token
  const sessionToken = request.cookies.get("session_token")?.value;

  if (!sessionToken) {
    if (pathname === "/") return NextResponse.next();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify signed token (async — uses Web Crypto API)
  const payload = await verifySessionToken(sessionToken);
  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set("session_token", "", { path: "/", maxAge: 0 });
    return response;
  }

  // CSRF protection for authenticated state-changing API requests
  const method = request.method;
  if (
    pathname.startsWith("/api/") &&
    method !== "GET" &&
    method !== "HEAD" &&
    method !== "OPTIONS"
  ) {
    const csrfToken = request.headers.get("x-csrf-token");
    if (!csrfToken || !(await validateCsrfToken(csrfToken, sessionToken))) {
      return NextResponse.json({ success: false, error: "Invalid CSRF token" }, { status: 403 });
    }
  }

  // Role-based route gating
  const role = payload.role as UserRole;
  const sortedRoutes = [...ROUTE_ROLE_MAP].sort((a, b) => b.pattern.length - a.pattern.length);
  for (const route of sortedRoutes) {
    if (pathname.startsWith(route.pattern)) {
      if (!route.roles.includes(role)) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      break;
    }
  }

  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
}

function addSecurityHeaders(response: NextResponse): void {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
