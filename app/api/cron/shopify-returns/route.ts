import { NextResponse } from "next/server";
import { runShopifyReturnsSyncJob } from "@/lib/cron";
import { requireCronAuth } from "@/lib/cronAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const authError = requireCronAuth(req);
    if (authError) {
      return authError;
    }

    const results = await runShopifyReturnsSyncJob();
    return NextResponse.json({
      success: true,
      message: "Shopify returns sync completed",
      results,
    });
  } catch (error: any) {
    console.error("[Cron Shopify Returns] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
