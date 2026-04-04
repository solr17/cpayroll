import { NextResponse } from "next/server";
import { seedDemoData, isDemoMode, DEMO_CREDENTIALS } from "@/lib/demo/seed-demo";

/**
 * POST /api/demo/seed — Seed demo data (only works when DEMO_MODE=true)
 */
export async function POST() {
  if (!(await isDemoMode())) {
    return NextResponse.json(
      { success: false, error: "Demo mode is not enabled" },
      { status: 403 },
    );
  }

  try {
    await seedDemoData();
    return NextResponse.json({
      success: true,
      data: {
        message: "Demo data seeded successfully",
        credentials: DEMO_CREDENTIALS,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Seed failed" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/demo/seed — Check demo mode status
 */
export async function GET() {
  const demo = await isDemoMode();
  return NextResponse.json({
    success: true,
    data: {
      demoMode: demo,
      ...(demo ? { credentials: DEMO_CREDENTIALS } : {}),
    },
  });
}
