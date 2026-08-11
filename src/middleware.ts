import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Read-only endpoints anonymous visitors may call. Their handlers already
// restrict what they expose (published events only), so the middleware must let
// the GET through and leave the guarding to them. Everything else stays gated.
//
// `/api/community` is here for the same reason: the /community page renders to
// visitors with no session, and the handler itself hides `is_hidden` cards for
// everyone but staff. Cover images belong here too: `uploadToStorage` stores
// them as `/api/storage/event_images/...`, and `/` and `/events` render them to
// visitors with no session. The storage route still checks that the event is
// published before serving one.
//
// `/api/events/{id}/schedule` feeds the course-schedule card on the public
// detail page and answers `{ modules: [] }` for anything not published. Speaker
// avatars under `/api/storage/profile_images/` are public for the same reason —
// the detail page renders them to guests — but only when the storage route can
// tie the owner to a published event; ordinary account photos stay behind the
// session.
const isPublicApiGet = (req: NextRequest) => {
  if (req.method !== "GET") return false;
  const { pathname } = req.nextUrl;
  return (
    pathname === "/api/events" ||
    pathname === "/api/community" ||
    /^\/api\/events\/\d+$/.test(pathname) ||
    /^\/api\/events\/\d+\/schedule$/.test(pathname) ||
    /^\/api\/surveys\/[^/]+$/.test(pathname) ||
    pathname.startsWith("/api/storage/event_images/") ||
    pathname.startsWith("/api/storage/profile_images/")
  );
};

// Survey links are emailed to attendees with no session, so both reading the
// form and submitting it must pass through the middleware. The token is the
// credential; nothing else gates these routes.
const isPublicSurveyApi = (req: NextRequest) => {
  const { pathname } = req.nextUrl;
  return /^\/api\/surveys\/[^/]+\/submit$/.test(pathname);
};

// The profiler sink must be reachable without a session so samples from
// anonymous visitors still reach the dev terminal. The route itself 404s on a
// production build, so whitelisting it costs nothing deployed.
const isPublicApi = (req: NextRequest) => {
  return req.nextUrl.pathname === "/api/dev/profiler" || isPublicApiGet(req) || isPublicSurveyApi(req);
};

const isProtectedRoute = (req: NextRequest) => {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/staff")) return true;
  if (pathname.startsWith("/speaker")) return true;
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
    return !isPublicApi(req);
  }
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

  if (isProtectedRoute(req) && !user) {
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

/**
 * Still `middleware.ts`, which Next 16 deprecates in favour of `proxy.ts`.
 *
 * The rename is not cosmetic: `proxy.ts` runs on the Node runtime with no edge
 * opt-out, and the Cloudflare adapter can only bundle edge middleware, so it
 * exits with "Node.js middleware is not currently supported". Renaming this
 * file makes the application undeployable, which `pnpm cf:build` catches.
 *
 * Revisit when opennextjs-cloudflare ships Node middleware support:
 * https://github.com/opennextjs/opennextjs-cloudflare/issues/1309
 */
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
