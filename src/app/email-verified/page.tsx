import Link from "next/link";
import { isSafeRedirectPath } from "@/modules/auth/lib/redirect-url";

export default async function EmailVerifiedPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string }> }) {
  const { redirect_url } = await searchParams;
  const redirectUrl = isSafeRedirectPath(redirect_url) ? redirect_url : null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <span className="material-symbols-rounded mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-success/10 text-3xl text-success">
          check_circle
        </span>
        <h1 className="text-xl font-bold text-fg">Email verified</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-fg">Your email has been verified.</p>
        <Link
          href={redirectUrl ?? "/home"}
          prefetch={false}
          className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg shadow-sm transition-colors hover:bg-brand/90"
        >
          {redirectUrl ? "Continue to event" : "Go to home"}
        </Link>
      </div>
    </div>
  );
}
