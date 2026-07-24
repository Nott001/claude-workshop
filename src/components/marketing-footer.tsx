export function MarketingFooter() {
  return (
    <footer className="flex flex-col gap-0 rounded-2xl border border-[#bdc8d0] bg-white text-[#3E484F]">
      <div className="flex flex-wrap items-start justify-between gap-12 p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#3db9ee]">
            <svg className="size-[18px] text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-[#1B1C1C]">StartupLab</span>
        </div>

        <div className="flex gap-12">
          <div>
            <h5 className="mb-4 text-base font-bold text-[#1B1C1C]">Company</h5>
            <ul className="flex list-none flex-col gap-2 text-sm">
              <li>About Us</li>
              <li>Contact</li>
            </ul>
          </div>
          <div>
            <h5 className="mb-4 text-base font-bold text-[#1B1C1C]">Connect</h5>
            <div className="flex items-center gap-4">
              <a href="#" aria-label="Facebook" className="text-[#3E484F] transition-colors hover:text-[#3db9ee]">
                <svg className="size-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
              </a>
              <a href="#" aria-label="Twitter" className="text-[#3E484F] transition-colors hover:text-[#3db9ee]">
                <svg className="size-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="#" aria-label="LinkedIn" className="text-[#3E484F] transition-colors hover:text-[#3db9ee]">
                <svg className="size-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#bdc8d0] px-8 py-5">
        <span className="text-xs text-[#6E7980]">&copy; 2024 StartupLab Business Center. All rights reserved.</span>
      </div>
    </footer>
  );
}
