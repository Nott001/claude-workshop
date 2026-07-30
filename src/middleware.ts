import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isProtectedRoute = (pathname: string) => {
  if (pathname.startsWith("/staff")) return true;
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) return true;
  return false;
};

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // A refreshed session arrives as several cookies, because the auth token
        // is chunked. They have to land on one response: building a new response
        // per cookie throws away the ones already written to the previous one,
        // which leaves the browser holding half a session.
        for (const { name, value, options } of cookiesToSet) {
          req.cookies.set(name, value);
          res.cookies.set(name, value, options);
        }
        // Supabase hands us no-store headers alongside the cookies. Without them
        // a shared cache can replay this response, and its session, to whoever
        // asks next.
        for (const [header, value] of Object.entries(headers)) {
          res.headers.set(header, value);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (isProtectedRoute(req.nextUrl.pathname) && !user) {
    const denied = req.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : redirectToSignIn(req);

    // Refusing the request must not discard what Supabase just wrote — an
    // expired session is cleared through these cookies, and dropping the
    // deletion leaves the stale token in place to fail the same way next time.
    for (const cookie of res.cookies.getAll()) {
      denied.cookies.set(cookie);
    }
    return denied;
  }

  return res;
}

function redirectToSignIn(req: NextRequest) {
  const signInUrl = new URL("/sign-in", req.url);
  signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
