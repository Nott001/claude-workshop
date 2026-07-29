import Link from "next/link";

export default function EmailVerifiedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <span className="material-symbols-rounded mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-success/10 text-3xl text-success">
          check_circle
        </span>
        <h1 className="text-xl font-bold text-fg">Email verified</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-fg">
          Your email has been verified. You can close this tab and return to the previous one.
        </p>
        <Link
          href="/home"
          className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg shadow-sm transition-colors hover:bg-brand/90"
        >
          Go to home
        </Link>
      </div>
    </div>
  );
}
