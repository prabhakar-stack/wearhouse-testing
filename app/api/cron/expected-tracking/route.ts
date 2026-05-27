import { NextResponse } from "next/server";
import { runExpectedTrackingJob } from "@/lib/cron";
import { requireCronAuth } from "@/lib/cronAuth";

export async function GET(req: Request) {
  try {
    const authError = requireCronAuth(req);
    if (authError) {
      return authError;
    }

    const result = await runExpectedTrackingJob();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[Cron Expected Tracking] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
