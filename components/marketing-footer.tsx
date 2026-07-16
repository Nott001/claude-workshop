export function MarketingFooter() {
  return (
    <footer className="flex flex-wrap items-start justify-between gap-6 rounded-lg border border-border bg-elevated p-6 text-xs text-muted-foreground">
      <div className="max-w-[220px]">
        <strong className="text-sm font-semibold text-foreground">StartupLab</strong>
        <p className="mt-1.5">Empowering the next generation of business leaders through AI-driven innovation and education.</p>
      </div>
      <div>
        <h5 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company</h5>
        <ul className="flex list-none flex-col gap-1.5">
          <li>About us</li>
          <li>Contact</li>
        </ul>
      </div>
    </footer>
  );
}
