import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isProtectedRoute = (pathname: string) => {
  if (pathname.startsWith("/staff")) return true;
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) return true;
  return false;
};

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        req.cookies.set({ name, value, ...options });
        res = NextResponse.next({ request: { headers: req.headers } });
        res.cookies.set(name, value, options);
      },
      remove(name: string, options: Record<string, unknown>) {
        req.cookies.delete(name);
        res = NextResponse.next({ request: { headers: req.headers } });
        res.cookies.delete(name);
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (isProtectedRoute(req.nextUrl.pathname) && !user) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
