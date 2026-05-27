import { NextResponse } from "next/server";
import { runExpectedTrackingJob } from "@/lib/cron";
import { requireCronAuth } from "@/lib/cronAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const authError = requireCronAuth(req);
    if (authError) {
      return authError;
    }

    void runExpectedTrackingJob().catch((error: any) => {
      console.error("[Cron Expected Tracking] Background job failed:", error);
    });

    return NextResponse.json({
      success: true,
      queued: true,
      message: "Expected tracking job started",
    }, { status: 202 });
  } catch (error: any) {
    console.error("[Cron Expected Tracking] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
