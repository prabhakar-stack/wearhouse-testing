import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_OTP_BRIDGE_SECRET = "secret-otp-token";

export type OtpInboxRecord = {
  id: string;
  trackingId: string | null;
  otp: string;
  source: string | null;
  consumedAt: Date | null;
  createdAt: Date;
};

export function getConfiguredOtpBridgeSecret() {
  return process.env.OTP_BRIDGE_SECRET || DEFAULT_OTP_BRIDGE_SECRET;
}

export function getOtpBridgeSecret(req: Request) {
  const url = new URL(req.url);
  const authHeader = req.headers.get("authorization");
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);

  return (
    req.headers.get("x-otp-secret") ||
    url.searchParams.get("secret") ||
    bearerMatch?.[1] ||
    null
  );
}

export function requireOtpBridgeAuth(req: Request) {
  const providedSecret = getOtpBridgeSecret(req);
  const expectedSecret = getConfiguredOtpBridgeSecret();

  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function normalizeOtp(value: unknown) {
  return String(value ?? "").trim();
}

async function queryLatestOtp(trackingId?: string | null) {
  if (trackingId) {
    const rows = await prisma.$queryRaw<OtpInboxRecord[]>(Prisma.sql`
      SELECT "id", "trackingId", "otp", "source", "consumedAt", "createdAt"
      FROM "DeliveryOtp"
      WHERE "consumedAt" IS NULL
        AND "trackingId" = ${trackingId}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `);

    if (rows[0]) {
      return rows[0];
    }
  }

  const rows = await prisma.$queryRaw<OtpInboxRecord[]>(Prisma.sql`
    SELECT "id", "trackingId", "otp", "source", "consumedAt", "createdAt"
    FROM "DeliveryOtp"
    WHERE "consumedAt" IS NULL
    ORDER BY "createdAt" DESC
    LIMIT 1
  `);

  return rows[0] ?? null;
}

export async function storeIncomingOtp(params: {
  otp: string;
  trackingId?: string | null;
  source?: string | null;
}) {
  const otp = normalizeOtp(params.otp);

  if (!otp) {
    throw new Error("Missing OTP");
  }

  const trackingId = params.trackingId?.trim() || null;
  const source = params.source?.trim() || null;
  const id = crypto.randomUUID();

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "DeliveryOtp" ("id", "trackingId", "otp", "source", "consumedAt", "createdAt")
    VALUES (${id}, ${trackingId}, ${otp}, ${source}, NULL, NOW())
  `);

  return { id, trackingId, otp, source, consumedAt: null, createdAt: new Date() };
}

export async function getLatestOtp(trackingId?: string | null) {
  return queryLatestOtp(trackingId?.trim() || null);
}

export async function consumeOtp(id: string) {
  const otpId = String(id ?? "").trim();

  if (!otpId) {
    throw new Error("Missing OTP record id");
  }

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "DeliveryOtp"
    SET "consumedAt" = NOW()
    WHERE "id" = ${otpId}
  `);
}