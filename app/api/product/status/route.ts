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

    // 1. HARDWARE ESP32 POLLING
    if (!lpn) {
      const statusRecord = await prisma.hardwareStatus.findUnique({
        where: { id: 1 }
      });

      if (statusRecord) {
        return NextResponse.json({
          lpn: statusRecord.lpn,
          condition: statusRecord.status,
          espCondition: mapToEspCondition(statusRecord.status),
          timestamp: statusRecord.createdAt.getTime()
        });
      }
      return NextResponse.json({ error: "No products found" }, { status: 404 });
    }

    // 2. SIMPLIFIED LIVE LPN VERIFICATION (Only uses ReturnItem)
    const rawReturn = await prisma.returnItem.findUnique({
      where: { lpn }
    });

    if (!rawReturn) {
      return NextResponse.json({ error: "LPN not found in system" }, { status: 404 });
    }

    const resolvedFnsku = rawReturn.fnsku || rawReturn.sku;
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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lpn = typeof body?.lpn === "string" ? body.lpn.trim().toUpperCase() : "";
    const condition = typeof body?.condition === "string" ? body.condition.trim() : "";

    if (!lpn || !condition) {
      return NextResponse.json({ error: "Missing lpn or condition" }, { status: 400 });
    }

    const espCondition = mapToEspCondition(condition);
    const jsonPayload = { lpn, condition, espCondition, timestamp: Date.now() };

    // Write exactly to the single-row database table for hardware!
    await prisma.hardwareStatus.deleteMany({ where: { id: 1 } });
    await prisma.hardwareStatus.create({
      data: {
        id: 1,
        lpn,
        status: condition
      }
    });

    return NextResponse.json({
      success: true,
      status: jsonPayload,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
