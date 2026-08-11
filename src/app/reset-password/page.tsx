import { redirect } from "next/navigation";
import { AuthLayout } from "@/modules/auth/components/auth-layout";
import { isAuthToken } from "@/modules/auth/lib/auth-token";
import { evaluatePassword, MIN_PASSWORD_LENGTH } from "@/shared/lib/password-policy";

/** The canonical rule list, so this page cannot describe a policy it does not enforce. */
const REQUIREMENTS = evaluatePassword("").rules.map((rule) => rule.label);

const ERRORS: Record<string, string> = {
  weak_password: `That password does not meet the requirements: ${REQUIREMENTS.join("; ").toLowerCase()}.`,
  mismatch: "Those passwords did not match. Try again.",
};

/**
 * Stands between the emailed link and the reset it performs.
 *
 * Opening this page does nothing, for the same reason as /invite: verifying
 * spends the token, and mail scanners, security gateways and link previewers
 * all fetch the addresses they find in a message. Only the form below spends
 * it, and no scanner submits a form.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!isAuthToken(token)) {
    redirect("/sign-in?error=invalid_reset");
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <span className="material-symbols-rounded mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
            lock_reset
          </span>
          <h1 className="text-xl font-bold text-fg">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted-fg">This link can only be used once.</p>
        </div>

        {error && ERRORS[error] && (
          <p className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-red-800" role="alert">
            {ERRORS[error]}
          </p>
        )}

        {/* Plain form rather than the shared components: resetting a password is
            what a locked-out user does, and it should not depend on JavaScript
            having loaded. */}
        <form action="/api/auth/recover/confirm" method="post" className="space-y-4">
          <input type="hidden" name="token" value={token} />

          <div className="space-y-1.5">
            <label htmlFor="reset-password" className="text-sm font-medium text-fg">
              New password
            </label>
            <input
              id="reset-password"
              name="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-brand"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reset-confirm" className="text-sm font-medium text-fg">
              Confirm new password
            </label>
            <input
              id="reset-confirm"
              name="confirm"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg outline-none focus:border-brand"
            />
          </div>

          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg shadow-sm transition-colors hover:bg-brand/90"
          >
            Set new password
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}
