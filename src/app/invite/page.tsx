import { redirect } from "next/navigation";
import { AuthLayout } from "@/modules/auth/components/auth-layout";
import { isInviteToken } from "@/modules/auth/lib/invite-token";

/**
 * Stands between the emailed link and the invitation it accepts.
 *
 * Verifying spends the token — it is single-use — so it must not happen on a
 * GET. Mail scanners, security gateways and link previewers all fetch the
 * addresses they find in a message, and an earlier version of this route
 * redirected straight into Supabase's verification endpoint, which handed the
 * invitation to whichever machine looked first. The invitee then arrived at a
 * spent link, and the address counted as registered, so nobody could invite
 * them again either.
 *
 * Opening this page now does nothing. Only the form below accepts, and no
 * scanner submits a form.
 */
export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (!isInviteToken(token)) {
    redirect("/sign-in?error=invalid_invite");
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm text-center">
        <span className="material-symbols-rounded mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-brand/10 text-3xl text-brand">
          mail
        </span>
        <h1 className="text-xl font-bold text-fg">You have been invited</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-fg">
          Accept to set up your StartupLab Business Center account. The invitation can only be accepted once.
        </p>

        <form action="/api/auth/invite" method="post" className="mt-8">
          <input type="hidden" name="token" value={token} />
          {/* Plain button rather than the shared one: accepting an invitation is
              the first thing a new member does, and it should not depend on
              JavaScript having loaded. */}
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg shadow-sm transition-colors hover:bg-brand/90"
          >
            Accept invitation
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}
