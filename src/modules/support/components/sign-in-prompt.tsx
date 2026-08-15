"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { redirectUrlParam } from "@/modules/auth/lib/redirect-url";

const linkStyles = {
  primary:
    "inline-flex h-7 items-center justify-center rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg shadow-sm transition-colors hover:bg-brand/90",
  secondary:
    "inline-flex h-7 items-center justify-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-fg transition-colors hover:bg-muted",
};

/**
 * Ask a signed-out visitor to authenticate before chatting with support.
 * Carries the current path back through redirect_url so both the sign-in and
 * sign-up pages return here afterwards.
 */
export function SignInPrompt() {
  const pathname = usePathname();
  const redirectUrl = redirectUrlParam(pathname);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-muted-fg">Sign in or create an account to message a support staff.</p>
      <div className="flex gap-2">
        <Link href={`/sign-in${redirectUrl}`} className={linkStyles.primary}>
          Sign in
        </Link>
        <Link href={`/sign-up${redirectUrl}`} className={linkStyles.secondary}>
          Create account
        </Link>
      </div>
    </div>
  );
}
