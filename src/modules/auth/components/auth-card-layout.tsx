import { Brand } from "@/modules/shell/components/brand";
import { AuthBackLink } from "./auth-back-link";
import type { BackLinkOrigin } from "@/shared/lib/back-link";

/**
 * The returning-user shell: one raised card split between a brand panel and
 * whatever brought the user here — signing in, asking for a reset link, or
 * choosing a new password.
 *
 * Shared by those three because they are one errand seen at three moments, and
 * a user who bounces between them should not feel the page change underneath.
 * Sign-up keeps its own shell: it is addressed to someone with no account yet.
 *
 * A server component, so /reset-password can go on working with no JavaScript.
 */
export function AuthCardLayout({ children, backOrigin }: { children: React.ReactNode; backOrigin?: BackLinkOrigin }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4 sm:p-8">
      {/* Aligned to the card's own edge rather than the viewport's, so the link
          reads as belonging to it. */}
      <div className="w-full max-w-[1040px]">
        <AuthBackLink origin={backOrigin} className="mb-4" />
      </div>

      {/* The frame is 1294×910 — a card a little wider than it is tall, not a
          band across the display. Held to that ratio and to a width the form
          can fill, so the panel and the form stay in proportion instead of the
          card growing sideways into empty white. */}
      <div className="grid w-full max-w-[1040px] overflow-hidden rounded-3xl bg-surface shadow-2xl lg:min-h-[min(732px,calc(100dvh-6.5rem))] lg:grid-cols-[39fr_61fr]">
        <aside className="hidden flex-col justify-between bg-muted p-12 lg:flex">
          <Brand height={48} />

          <h1 className="text-[2.5rem] leading-[1.16] font-bold tracking-[-0.02em] text-fg">
            Empowering the next generation of <span className="text-brand">innovators</span>.
          </h1>

          <p className="text-base leading-7 text-muted-fg">
            Access exclusive resources, networking events, and business acceleration tools designed for high-growth startups.
          </p>

          {/* The frame's trailing spacer. It is what holds the copy in the upper
              two thirds instead of letting it settle against the bottom edge. */}
          <div aria-hidden className="h-32" />
        </aside>

        <div className="flex items-center justify-center px-6 py-12 sm:px-12">
          <div className="w-full max-w-sm">
            {/* The panel that carries the mark is gone at this width, and a page
                asking for a password should still say whose it is. */}
            <Brand height={40} className="mb-8 justify-center lg:hidden" />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
