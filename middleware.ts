import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/courses(.*)",
  "/kiosk(.*)",
  "/api/((?!auth|events|speakers|payments/webhook).*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // DEBUG: Bypass auth when debug_mode cookie is set
  const debugMode = req.cookies.get("debug_mode")?.value === "true";
  if (debugMode) {
    return NextResponse.next();
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
