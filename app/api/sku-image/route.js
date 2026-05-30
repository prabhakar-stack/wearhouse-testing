import { NextResponse } from 'next/server';

export async function GET(request) {
  // Extract the SKU from the URL query parameters (e.g., /api/sku-image?sku=123)
  const { searchParams } = new URL(request.url);
  const sku = searchParams.get('sku');

  if (!sku) {
    return NextResponse.json({ error: 'SKU parameter is required' }, { status: 400 });
  }

  const domain = process.env.SHOPIFY_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION || '2024-01';

  const url = `https://${domain}/admin/api/${version}/graphql.json`;

  const query = `
    query getVariantImage($query: String!) {
      productVariants(first: 1, query: $query) {
        edges {
          node {
            image {
              url
            }
            product {
              featuredImage {
                url
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { query: `sku:${sku}` },
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Shopify API responded with status ${response.status}` },
        { status: response.status }
      );
    }

    const { data } = await response.json();
    const edges = data?.productVariants?.edges || [];

    if (edges.length === 0) {
      return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
    }

    const node = edges[0].node;
    // Fallback: Variant Image -> Product Featured Image -> Null
    const imageUrl = node.image?.url || node.product?.featuredImage?.url || null;

    return NextResponse.json({ sku, imageUrl });

  } catch (error) {
    console.error('Shopify Fetch Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}