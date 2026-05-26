import { NextResponse } from "next/server";
import { createRequire } from "module";
import path from "path";

export const runtime = "nodejs";

const require = createRequire(import.meta.url);
const {
  main: runAmazonRawSync,
} = require(path.join(process.cwd(), "scripts", "fetch_amz_raw_reports.cjs"));

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const expectedToken = `Bearer ${process.env.CRON_SECRET || "secret-cron-token"}`;

    if (authHeader !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await runAmazonRawSync();
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
