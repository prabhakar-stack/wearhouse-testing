import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── Shopify Variant Image Fetcher ─────────────────────────────────────────
async function fetchShopifyVariantImage(sku: string): Promise<string | null> {
  try {
    const domain = process.env.SHOPIFY_DOMAIN;
    const token = process.env.SHOPIFY_ACCESS_TOKEN;
    const version = process.env.SHOPIFY_API_VERSION || "2024-01";
    if (!domain || !token) return null;

    const res = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `query getVariantImage($query: String!) {
          productVariants(first: 1, query: $query) {
            edges {
              node {
                image { url }
                product { featuredImage { url } }
              }
            }
          }
        }`,
        variables: { query: `sku:${sku}` },
      }),
    });

    if (!res.ok) return null;
    const { data } = await res.json();
    const edges = data?.productVariants?.edges || [];
    if (edges.length === 0) return null;
    const node = edges[0].node;
    return node.image?.url || node.product?.featuredImage?.url || null;
  } catch {
    return null;
  }
}

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



export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lpn = searchParams.get("lpn")?.trim().toUpperCase();
    const trackingId = searchParams.get("trackingId")?.trim() || searchParams.get("orderId")?.trim();

    // If no specific LPN is requested, fallback to returning the latest ReturnItem (legacy dashboard poll)
    if (!lpn) {
      const latestItem = await prisma.returnItem.findFirst({
        orderBy: [{ returnDate: "desc" }, { lpn: "desc" }],
        select: {
          lpn: true,
        },
      });

      if (!latestItem) {
        return NextResponse.json({ error: "No products found" }, { status: 404 });
      }

      // Look up its condition from ItemStatus
      const itemStatus = await prisma.itemStatus.findUnique({
        where: { lpn: latestItem.lpn }
      });

      const condition = itemStatus ? (itemStatus.status === 'GOOD' ? 'GOOD_SELLABLE' : 'PACKAGING_DAMAGED') : 'PRODUCT_DAMAGED';

      return NextResponse.json({
        lpn: latestItem.lpn,
        condition: condition,
        espCondition: mapToEspCondition(condition),
      });
    }

    // Live LPN verification - search in ReturnItem
    const rawReturn = await prisma.returnItem.findUnique({
      where: { lpn }
    });

    if (!rawReturn) {
      return NextResponse.json({ error: "LPN not binned / expected" }, { status: 404 });
    }

    const resolvedFnsku = rawReturn.fnsku || rawReturn.sku;

    // Validate the FNSKU against shipments for the provided trackingId / manifest
    if (trackingId) {
      // Find the manifest linked to this trackingId or orderId or removalOrderId
      const manifest = await prisma.manifest.findFirst({
        where: {
          OR: [
            { trackingId: trackingId },
            { removalOrderId: trackingId },
            { id: trackingId },
            { orders: { some: { platformOrderId: trackingId } } },
            { orders: { some: { trackingNumber: trackingId } } }
          ]
        },
        include: {
          orders: true
        }
      });

      let shipments: any[] = [];
      if (manifest) {
        const orderIds = (manifest.orders || []).map(o => o.platformOrderId);
        const trackingNumbers = [
          manifest.trackingId,
          manifest.removalOrderId,
          ...(manifest.orders || []).map(o => o.trackingNumber)
        ].filter((t): t is string => !!t);

        shipments = await prisma.aMZRemovalShipment.findMany({
          where: {
            OR: [
              { orderId: { in: orderIds } },
              { trackingNumber: { in: trackingNumbers } }
            ]
          }
        });
      } else {
        // Fallback: look up shipments directly by tracking number or orderId
        shipments = await prisma.aMZRemovalShipment.findMany({
          where: {
            OR: [
              { trackingNumber: trackingId },
              { orderId: trackingId }
            ]
          }
        });
      }

      const isExpected = shipments.some(s => 
        (s.sku && s.sku === rawReturn.sku) ||
        (s.fnsku && s.fnsku === resolvedFnsku) ||
        (s.sku && s.sku === resolvedFnsku) ||
        (s.fnsku && s.fnsku === rawReturn.sku)
      );

      if (!isExpected) {
        return NextResponse.json(
          { error: `This item (FNSKU: ${resolvedFnsku}) is not expected for tracking ID ${trackingId}.` },
          { status: 400 }
        );
      }
    }

    // Fetch the Shopify variant reference image (non-blocking, best-effort)
    const imageUrl = rawReturn.sku ? await fetchShopifyVariantImage(rawReturn.sku) : null;

    return NextResponse.json({
      success: true,
      lpn: rawReturn.lpn,
      sku: rawReturn.sku || "UNKNOWN_SKU",
      fnsku: resolvedFnsku,
      productName: rawReturn.productName || `SKU: ${rawReturn.sku}`,
      customerComments: rawReturn.customerComments || null,
      imageUrl,
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

    // Resolve details from ReturnItem
    const rawReturn = await prisma.returnItem.findUnique({
      where: { lpn }
    });





// Dynamically upsert ReturnItem without deprecated fields
await prisma.returnItem.upsert({
  where: { lpn },
  update: {},
  create: {
    lpn,
    sku: rawReturn?.sku || "UNKNOWN_SKU",
    asin: rawReturn?.asin || null,
    fnsku: rawReturn?.fnsku || null,
    productName: rawReturn?.productName || `SKU: ${rawReturn?.sku || "UNKNOWN"}`,
    reason: rawReturn?.reason || "Removal Order Shipment",
    customerComments: rawReturn?.customerComments || null,
    // marketplace defaults to "amazon"
  },
  select: { lpn: true }
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
      status: {
        lpn,
        condition,
        espCondition: mapToEspCondition(condition)
      },
    });
  } catch (error: any) {
    console.error("POST Product Status Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
