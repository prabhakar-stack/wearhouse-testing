import { NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function POST(req: Request) {
  try {
    const { endpoint } = await req.json();
    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    const allowed = ["/api/cron/smarthub-sync"];
    if (!allowed.includes(endpoint)) {
      return NextResponse.json({ error: "Endpoint not allowed" }, { status: 400 });
    }

    const url = new URL(endpoint, req.url);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
