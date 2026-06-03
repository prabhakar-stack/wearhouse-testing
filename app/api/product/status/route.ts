import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// ─── Temporary File Path ──────────────────────────────────────────────
const TEMP_FILE_PATH = path.join(process.cwd(), "temp_status.json");

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
      // Read directly from the temporary JSON file!
      if (fs.existsSync(TEMP_FILE_PATH)) {
        const fileData = fs.readFileSync(TEMP_FILE_PATH, "utf-8");
        return NextResponse.json(JSON.parse(fileData));
      }
      return NextResponse.json({ error: "No products found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Database bypassed for temporary JSON file." }, { status: 400 });
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

    // Write exactly to the temporary JSON file!
    fs.writeFileSync(TEMP_FILE_PATH, JSON.stringify(jsonPayload));

    return NextResponse.json({
      success: true,
      status: jsonPayload,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
