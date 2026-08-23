import { NextResponse } from "next/server";

import { isPasscodeProtectedPath } from "@/data/work-items";
import { PASSCODE_COOKIE, readPasscodeAccess, verifyPasscode } from "@/lib/passcode-server";
import { normalizePath } from "@/lib/passcode";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readPasscodeAccess());
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { action?: string; scope?: string; code?: string }
    | null;

  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  if (body.action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(PASSCODE_COOKIE);
    return res;
  }

  const scope = normalizePath(body.scope ?? "");
  if (!isPasscodeProtectedPath(scope)) return NextResponse.json({ ok: false }, { status: 400 });
  if (!verifyPasscode(body.code ?? "")) return NextResponse.json({ ok: false }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PASSCODE_COOKIE, scope, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
