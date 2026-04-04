/**
 * CSRF-aware fetch wrapper.
 * Reads the csrf_token cookie and attaches it as x-csrf-token header
 * on all non-GET requests.
 */

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

/**
 * Drop-in replacement for fetch() that automatically includes CSRF token.
 * Use this for all API calls from the frontend.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);

  // Always set JSON content type if body is present and no content-type set
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Attach CSRF token for state-changing requests
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    headers.set("x-csrf-token", getCsrfToken());
  }

  return fetch(url, { ...options, headers });
}
