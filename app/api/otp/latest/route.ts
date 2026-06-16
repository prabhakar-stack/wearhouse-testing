import { NextResponse } from "next/server";
import { consumeOtp, getLatestOtp } from "@/lib/otpInbox";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  // Rate limit: 30 OTP reads per IP per minute
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, 'otp:read', 30, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterSec);

  try {
    const url = new URL(req.url);
    const trackingId = url.searchParams.get("trackingId");

    if (!trackingId || trackingId.trim() === "") {
      return NextResponse.json({ error: 'Missing trackingId query parameter' }, { status: 400 });
    }

    const record = await getLatestOtp(trackingId);

    return NextResponse.json({
      success: true,
      available: !!record,
      record,
    });
  } catch (error: any) {
    console.error("[OTP Latest] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = body?.id;

    await consumeOtp(id);

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("[OTP Consume] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}