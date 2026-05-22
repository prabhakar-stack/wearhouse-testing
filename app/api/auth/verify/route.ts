import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

const JWT_SECRET =
  process.env.JWT_SECRET || "fallback_secret_for_dev_only_change_in_prod";
const isProduction = process.env.NODE_ENV === "production";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Missing email." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: `You are not authorized. User (${email}) lacks access to this system.`,
        },
        { status: 401 },
      );
    }

    const resolvedName = user.name || user.email;

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, name: resolvedName },
      JWT_SECRET,
      { expiresIn: "12h" },
    );

    const response = NextResponse.json({ success: true, role: user.role, name: resolvedName });
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "System Authentication failed." },
      { status: 500 },
    );
  }
}