import Link from "next/link";

export default function EmailLinkExpiredPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <span className="material-symbols-rounded mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-warning/10 text-3xl text-warning">
          link_off
        </span>
        <h1 className="text-xl font-bold text-fg">Email link no longer valid</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-fg">
          This link has expired or been replaced, so it can no longer be used.
        </p>
        <Link
          href="/user"
          className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg shadow-sm transition-colors hover:bg-brand/90"
        >
          Go to settings
        </Link>
      </div>
    </div>
  );
}
