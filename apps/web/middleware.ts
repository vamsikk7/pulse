import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth is intentionally disabled for now — all requests pass through.
 * A fixed `user_demo_seed` userId is used on the API side.
 */
export default function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
