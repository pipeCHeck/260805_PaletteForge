import { NextRequest, NextResponse } from "next/server";
import { isLocalizedPublicLanguage } from "./app/public-locale";

export function proxy(request: NextRequest) {
  const firstSegment = request.nextUrl.pathname.split("/").filter(Boolean)[0] ?? "";
  const language = isLocalizedPublicLanguage(firstSegment) ? firstSegment : "ko";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-palette-forge-language", language);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
