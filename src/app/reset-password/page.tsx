import { redirect } from "next/navigation";
import { AuthCardLayout } from "@/modules/auth/components/auth-card-layout";
import { AuthHeading } from "@/modules/auth/components/auth-heading";
import { isAuthToken } from "@/modules/auth/lib/auth-token";
import { evaluatePassword, MIN_PASSWORD_LENGTH } from "@/shared/lib/password-policy";

/** The canonical rule list, so this page cannot describe a policy it does not enforce. */
const REQUIREMENTS = evaluatePassword("").rules.map((rule) => rule.label);

const ERRORS: Record<string, string> = {
  weak_password: `That password does not meet the requirements: ${REQUIREMENTS.join("; ").toLowerCase()}.`,
  mismatch: "Those passwords did not match. Try again.",
  personal_password:
    "That password was too close to your name or email address. That link has now been used, so please request a new one.",
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
    <AuthCardLayout>
      <div>
        <AuthHeading title="Choose a new password" subtitle="This link can only be used once." />

        {error && ERRORS[error] && (
          <p className="mt-6 rounded-lg bg-error/10 px-3 py-2 text-sm text-red-800" role="alert">
            {ERRORS[error]}
          </p>
        )}

        {/* Plain form rather than the shared components: resetting a password is
            what a locked-out user does, and it should not depend on JavaScript
            having loaded. */}
        <form action="/api/auth/recover/confirm" method="post" className="mt-8 space-y-6">
          <input type="hidden" name="token" value={token} />

          <div className="space-y-1.5">
            <label htmlFor="reset-password" className="text-sm font-medium tracking-wider text-fg">
              New password
            </label>
            <input
              id="reset-password"
              name="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className="h-12 w-full rounded-lg border border-border bg-surface px-4 text-base text-fg transition-colors outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reset-confirm" className="text-sm font-medium tracking-wider text-fg">
              Confirm new password
            </label>
            <input
              id="reset-confirm"
              name="confirm"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className="h-12 w-full rounded-lg border border-border bg-surface px-4 text-base text-fg transition-colors outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
            />
          </div>

          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-brand px-4 text-base font-semibold text-brand-fg shadow-lg shadow-brand/20 transition-colors hover:bg-brand/90"
          >
            Set new password
          </button>
        </form>
      </div>
    </AuthCardLayout>
  );
}
