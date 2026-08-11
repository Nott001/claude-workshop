import { roleHome } from "./role-home";

/**
 * Where a freshly signed-in user should be sent.
 *
 * An explicit redirect_url wins: it means the middleware bounced a protected-
 * page request to sign-in, so the user should return there. Otherwise they go
 * to the landing page for their role. The root is the fallback because
 * PostLoginRedirect lives there and reroutes by role anyway, so a role we
 * cannot resolve still ends in the right place.
 */
export async function resolvePostSignInDestination(redirectUrl: string | null | undefined): Promise<string> {
  if (redirectUrl) return redirectUrl;

  try {
    const res = await fetch("/api/auth/me");
    const data = res.ok ? await res.json() : null;
    return roleHome(data?.role);
  } catch {
    return "/";
  }
}
