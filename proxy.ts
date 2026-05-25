import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (code && !req.nextUrl.pathname.startsWith("/auth/")) {
    const callbackUrl = new URL("/auth/callback", req.url);
    callbackUrl.searchParams.set("code", code);
    return NextResponse.redirect(callbackUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};