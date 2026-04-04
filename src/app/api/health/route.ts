import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Health check endpoint — verifies app + database connectivity.
 * Returns 200 if healthy, 503 if database is unreachable.
 */
export async function GET() {
  const start = Date.now();

  try {
    await db.execute(sql`SELECT 1`);
    const dbLatencyMs = Date.now() - start;

    return NextResponse.json(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: "up", latencyMs: dbLatencyMs },
        },
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: "down" },
        },
      },
      { status: 503 },
    );
  }
}
