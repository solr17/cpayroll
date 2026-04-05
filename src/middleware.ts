import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { UserRole } from "@/types";
import { verifySessionToken } from "@/lib/auth/session-token";
import { validateCsrfToken } from "@/lib/security/csrf";

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

/**
 * Route-based role restrictions.
 * Actual role enforcement happens in API route handlers via requireRole().
 */
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

/**
 * API rate limiting — 100 requests per minute per IP for general API routes.
 *
 * This intentionally uses an in-memory Map rather than the Redis-backed limiter
 * from src/lib/security/rate-limit.ts. Next.js middleware runs in a constrained
 * runtime where async Redis calls are unreliable across deployment modes
 * (Edge, Node, serverless). The in-memory approach provides best-effort
 * protection here; the authoritative Redis-backed rate limiter runs inside
 * individual API route handlers (e.g., login) where async is safe.
 */
const apiRateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkApiRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 100;

  // Inline cleanup when map grows large to prevent memory leaks
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

export function middleware(request: NextRequest) {
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

  // Verify signed token
  const payload = verifySessionToken(sessionToken);
  if (!payload) {
    // Token invalid or expired — clear it and redirect to login
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
    if (!csrfToken || !validateCsrfToken(csrfToken, sessionToken)) {
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

/** Security headers applied to every response */
function addSecurityHeaders(response: NextResponse): void {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

export const runtime = "nodejs";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
