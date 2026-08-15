import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <span className="material-symbols-rounded text-[48px] text-muted-fg">explore_off</span>
      <h1 className="text-2xl font-bold text-fg">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-fg">
        The page you&apos;re looking for doesn&apos;t exist. Check the address, or head back to your home page.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand/80"
      >
        Go to home
      </Link>
    </div>
  );
}
