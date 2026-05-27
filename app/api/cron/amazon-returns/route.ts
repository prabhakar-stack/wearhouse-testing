import { NextResponse } from "next/server";
import { runAmazonReturnsJob } from "@/lib/cron";
import { requireCronAuth } from "@/lib/cronAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const authError = requireCronAuth(req);
    if (authError) {
      return authError;
    }

    void runAmazonReturnsJob().catch((error: any) => {
      console.error("[Cron Amazon Returns] Background job failed:", error);
    });

    return NextResponse.json({
      success: true,
      queued: true,
      message: "Amazon raw report fetch and sync started",
    }, { status: 202 });
  } catch (error: any) {
    console.error("[Cron Amazon Returns] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
