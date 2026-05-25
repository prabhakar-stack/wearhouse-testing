import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

async function resolveFnskuForSku(sku: string): Promise<string | null> {
  const ret = await prisma.aMZCustomerReturn.findFirst({
    where: { sku },
    select: { fnsku: true }
  });
  if (ret?.fnsku) return ret.fnsku;

  const rem = await prisma.aMZRemovalOrder.findFirst({
    where: { sku },
    select: { fnsku: true }
  });
  if (rem?.fnsku) return rem.fnsku;

  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lpn = searchParams.get("lpn")?.trim().toUpperCase();
    const orderId = searchParams.get("orderId")?.trim();

    // If no specific LPN is requested, fallback to returning the latest ReturnItem (legacy dashboard poll)
    if (!lpn) {
      const latestItem = await prisma.returnItem.findFirst({
        orderBy: [{ order: { requestDate: "desc" } }, { lpn: "desc" }],
        select: {
          lpn: true,
          condition: true,
        },
      });

      if (!latestItem) {
        return NextResponse.json({ error: "No products found" }, { status: 404 });
      }

      return NextResponse.json({
        lpn: latestItem.lpn,
        condition: latestItem.condition ?? "UNKNOWN",
        espCondition: mapToEspCondition(latestItem.condition ?? null),
      });
    }

    // Live LPN verification
    const rawReturn = await prisma.aMZCustomerReturn.findUnique({
      where: { lpn }
    });

    if (!rawReturn) {
      return NextResponse.json(
        { error: "LPN not found in customer returns database." },
        { status: 400 }
      );
    }

    const resolvedFnsku = rawReturn.fnsku || rawReturn.sku || "UNKNOWN_FNSKU";

    if (orderId) {
      // Find shipments linked to this removalOrderId or tracking ID
      const shipments = await prisma.removalShipment.findMany({
        where: {
          OR: [
            { removalOrderId: orderId },
            { trackingNumber: orderId }
          ]
        }
      });

      const expectedSkus = new Set(shipments.map(s => s.sku).filter(Boolean) as string[]);
      let isExpected = expectedSkus.has(rawReturn.sku || "");

      if (!isExpected) {
        // Double check matching by resolving SKUs to FNSKUs
        for (const s of shipments) {
          if (!s.sku) continue;
          const fnsku = await resolveFnskuForSku(s.sku) || s.sku;
          if (fnsku === resolvedFnsku) {
            isExpected = true;
            break;
          }
        }
      }

      if (!isExpected) {
        return NextResponse.json(
          { error: `This item (FNSKU: ${resolvedFnsku}) is not expected in removal order ${orderId}.` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      lpn: rawReturn.lpn,
      sku: rawReturn.sku || "UNKNOWN_SKU",
      fnsku: resolvedFnsku,
      productName: rawReturn.productName || `SKU: ${rawReturn.sku}`,
      customerComments: rawReturn.customerComments || null,
      amazonDisposition: rawReturn.detailedDisposition || "SELLABLE",
      customerOrderId: rawReturn.orderId || "UNKNOWN_CUSTOMER_ORDER",
    });

  } catch (error: any) {
    console.error("GET Product Status Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lpn = typeof body?.lpn === "string" ? body.lpn.trim().toUpperCase() : "";
    const orderPlatformId =
      typeof body?.orderPlatformId === "string" ? body.orderPlatformId.trim() : "";
    const condition =
      typeof body?.condition === "string" ? body.condition.trim() : "";
    const recoveryType =
      typeof body?.recoveryType === "string" ? body.recoveryType.trim() : "";

    if (!lpn || !condition) {
      return NextResponse.json(
        { error: "Missing lpn or condition" },
        { status: 400 },
      );
    }

    if (!ALLOWED_CONDITIONS.has(condition)) {
      return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
    }

    // Resolve details from AMZCustomerReturn for upsert
    const rawReturn = await prisma.aMZCustomerReturn.findUnique({
      where: { lpn }
    });

    if (orderPlatformId) {
      const existingItem = await prisma.returnItem.findUnique({
        where: { lpn },
        select: { orderId: true },
      });

      if (existingItem && existingItem.orderId !== orderPlatformId) {
        return NextResponse.json(
          { error: "LPN already belongs to a different order" },
          { status: 400 },
        );
      }
    }

    // Dynamic upsert of ReturnItem matching active orderPlatformId on scan/binning evaluation
    const status = await prisma.returnItem.upsert({
      where: { lpn },
      update: {
        condition: condition as any,
        ...(orderPlatformId ? { orderId: orderPlatformId } : {}),
      },
      create: {
        lpn,
        orderId: orderPlatformId || "UNKNOWN_ORDER",
        sku: rawReturn?.sku || "UNKNOWN_SKU",
        asin: rawReturn?.asin || null,
        fnsku: rawReturn?.fnsku || null,
        productName: rawReturn?.productName || `SKU: ${rawReturn?.sku || "UNKNOWN"}`,
        returnReason: rawReturn?.reason || "Removal Order Shipment",
        customerComments: rawReturn?.customerComments || null,
        amazonDisposition: rawReturn?.detailedDisposition || "SELLABLE",
        customerOrderId: rawReturn?.orderId || "UNKNOWN_CUSTOMER_ORDER",
        condition: condition as any,
      },
      select: {
        lpn: true,
        condition: true,
      }
    });

    if (condition === "GOOD_SELLABLE") {
      await prisma.itemStatus.upsert({
        where: { lpn },
        update: { status: "GOOD", recoveryType: null },
        create: { lpn, status: "GOOD", recoveryType: null }
      });
      await prisma.evidence.deleteMany({
        where: { lpn }
      });
    } else if (condition === "PACKAGING_DAMAGED") {
      await prisma.itemStatus.upsert({
        where: { lpn },
        update: { status: "RECOVERY", recoveryType: recoveryType || null },
        create: { lpn, status: "RECOVERY", recoveryType: recoveryType || null }
      });
      await prisma.evidence.deleteMany({
        where: { lpn }
      });
    } else {
      await prisma.itemStatus.deleteMany({
        where: { lpn }
      });
    }

    return NextResponse.json({
      success: true,
      status: { ...status, espCondition: mapToEspCondition(status.condition) },
    });
  } catch (error: any) {
    console.error("POST Product Status Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
