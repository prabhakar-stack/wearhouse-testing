import { NextResponse } from "next/server";
import { requireOtpBridgeAuth, storeIncomingOtp } from "@/lib/otpInbox";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const authError = requireOtpBridgeAuth(req);
    if (authError) {
      return authError;
    }

    const body = await req.json();
    const otp = body?.otp ?? body?.code ?? body?.value;
    const trackingId = body?.trackingId ?? null;
    const source = body?.source ?? "rs232-bridge";

    if (!trackingId || String(trackingId).trim() === "") {
      return NextResponse.json({ error: 'Missing trackingId in request body' }, { status: 400 });
    }

    const record = await storeIncomingOtp({
      otp,
      trackingId,
      source,
    });

    return NextResponse.json({
      success: true,
      record,
    });
  } catch (error: any) {
    console.error("[OTP Bridge] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}