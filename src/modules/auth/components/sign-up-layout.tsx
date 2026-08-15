import { TopNavbar } from "@/modules/shell/components/top-navbar";
import { AuthBackLink } from "./auth-back-link";
import type { BackLinkOrigin } from "@/shared/lib/back-link";

/**
 * The sign-up screen's own shell: a pitch on the left, the form on the right.
 *
 * Separate from AuthLayout because the pitch is written for someone who has no
 * account yet. The same words next to a password-reset form would be answering
 * a question that user did not ask.
 *
 * The left column is presentation, so below `lg` it gives way entirely rather
 * than pushing the form under a fold — signing up is the errand; the photo is
 * not.
 */
export function SignUpLayout({ children, backOrigin }: { children: React.ReactNode; backOrigin?: BackLinkOrigin }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* The app's own bar, stripped to the mark. Rendered here rather than by
          AppShell, whose non-hidden branch also brings the site footer and
          would hand a signed-in admin the staff sidebar over a sign-up form. */}
      <TopNavbar minimal />

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col px-6 py-8 lg:px-16">
        <AuthBackLink origin={backOrigin} className="mb-8" />

        {/* The row stays vertically centred in whatever height is left, so the
            back link sits above the fold rather than shifting the form down. */}
        <div className="flex flex-1 items-center justify-center gap-6">
          <section className="hidden max-w-[638px] flex-1 flex-col gap-8 lg:flex">
            <div className="flex flex-col gap-4">
              <h1 className="text-5xl leading-[1.16] font-bold tracking-[-0.02em] text-fg text-balance">
                Empowering the next <span className="text-brand">generation of founders.</span>
              </h1>
              <p className="max-w-[448px] text-lg leading-7 text-muted-fg">
                Join a community of innovators, access premium resources, and scale your business at StartupLab Business Center.
              </p>
            </div>

            {/* Decorative, so it carries an empty alt rather than describing a stock
              photo to someone who came here to fill in a form. */}
            <img
              src="/images/signup-hero.jpg"
              alt=""
              width={512}
              height={279}
              className="w-[531px] max-w-full rounded-2xl shadow-lg"
            />
          </section>

          <div className="w-full max-w-[448px] shrink-0">{children}</div>
        </div>
      </main>
    </div>
  );
}
