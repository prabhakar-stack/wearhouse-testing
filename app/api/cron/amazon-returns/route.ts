import { NextResponse } from "next/server";
import { runAmazonReturnsJob } from "@/lib/cron";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const expectedToken = `Bearer ${process.env.CRON_SECRET || "secret-cron-token"}`;

    if (authHeader !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await runAmazonReturnsJob();
    return NextResponse.json({
      success: true,
      message: "Amazon raw report fetch and sync completed",
    });
  } catch (error: any) {
    console.error("[Cron Amazon Returns] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
