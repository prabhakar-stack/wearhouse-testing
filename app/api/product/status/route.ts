import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CURRENT_STATUS_ID = "current";
const ALLOWED_CONDITIONS = new Set([
  "GOOD_SELLABLE",
  "PACKAGING_DAMAGED",
  "PRODUCT_DAMAGED",
  "WRONG_ITEM",
  "MISSING",
  "BAD_FAKE_PRODUCT",
]);

function mapToEspCondition(cond?: string | null) {
  if (!cond) return "BAD";
  if (cond === "GOOD_SELLABLE") return "GOOD";
  if (cond === "PACKAGING_DAMAGED") return "REPAIRABLE";
  return "BAD";
}

export async function GET() {
  try {
    const currentStatus = await prisma.productStatus.findUnique({
      where: { id: CURRENT_STATUS_ID },
      select: {
        lpn: true,
        condition: true,
      },
    });

    if (currentStatus) {
      return NextResponse.json({
        lpn: currentStatus.lpn,
        condition: currentStatus.condition,
        espCondition: mapToEspCondition(currentStatus.condition),
      });
    }

    // Fallback to the latest persisted ReturnItem when no live status has been pushed yet.
    const latestItem = await prisma.returnItem.findFirst({
      orderBy: [{ order: { purchaseDate: "desc" } }, { lpn: "desc" }],
      select: {
        lpn: true,
        condition: true,
      },
    });

    // If no product found
    if (!latestItem) {
      return NextResponse.json(
        {
          error: "No products found",
        },
        {
          status: 404,
        },
      );
    }

    // Return latest product
    return NextResponse.json({
      lpn: latestItem.lpn,
      condition: latestItem.condition ?? "UNKNOWN",
      espCondition: mapToEspCondition(latestItem.condition ?? null),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Internal Server Error",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lpn = typeof body?.lpn === "string" ? body.lpn.trim() : "";
    const condition =
      typeof body?.condition === "string" ? body.condition.trim() : "";

    if (!lpn || !condition) {
      return NextResponse.json(
        { error: "Missing lpn or condition" },
        { status: 400 },
      );
    }

    if (!ALLOWED_CONDITIONS.has(condition)) {
      return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
    }

    const status = await prisma.productStatus.upsert({
      where: { id: CURRENT_STATUS_ID },
      update: {
        lpn,
        condition: condition as any,
      },
      create: {
        id: CURRENT_STATUS_ID,
        lpn,
        condition: condition as any,
      },
      select: {
        lpn: true,
        condition: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      status: { ...status, espCondition: mapToEspCondition(status.condition) },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Internal Server Error",
      },
      {
        status: 500,
      },
    );
  }
}
