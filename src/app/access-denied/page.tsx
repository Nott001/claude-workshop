import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg">
      <h1 className="mb-4 text-[32px] font-bold text-fg">Access Denied</h1>
      <p className="mb-8 text-sm text-muted-fg">You do not have permission to access this page.</p>
      <Link href="/" className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand/80">
        Go Home
      </Link>
    </div>
  );
}
