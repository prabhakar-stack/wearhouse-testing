import { NextRequest, NextResponse } from "next/server";
import { runShopifyReturnsSyncJob } from "@/lib/cron";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const role = req.headers.get("x-user-role");
  if (!role || !["ADMIN", "SUPER_ACCESS"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const results = await runShopifyReturnsSyncJob();
    return NextResponse.json({
      success: true,
      message: "Shopify returns sync completed",
      results,
    });
  } catch (error: any) {
    console.error("[Shopify Sync API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Sync failed" },
      { status: 500 },
    );
  }
}
