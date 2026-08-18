import { Brand } from "@/modules/shell/components/brand";
import { ContactDialog } from "@/modules/shell/components/contact-dialog";
import { isExternalHref, usesStaffFooter, PUBLIC_FOOTER_LINKS, type FooterLink } from "@/modules/shell/lib/footer-links";
import Link from "next/link";
import { cn } from "@/shared/lib/utils";
import type { UserRole } from "@/shared/types";

const COPYRIGHT = "© 2026 StartupLab Business Center. All rights reserved.";

const linkClass = "flex items-center gap-2 text-sm leading-5 text-muted-fg transition-colors hover:text-fg";

export function Footer({ role = null }: { role?: UserRole | null }) {
  return usesStaffFooter(role) ? <StaffFooter /> : <PublicFooter />;
}

/** Staff pages carry their own chrome, so the console keeps the plain copyright bar. */
function StaffFooter() {
  return (
    <footer className="mt-auto flex items-center justify-between border-t border-border bg-bg px-6 py-6">
      <p className="text-sm font-medium tracking-wider text-muted-fg">{COPYRIGHT}</p>
    </footer>
  );
}

function PublicFooter() {
  return (
    <footer className="mt-auto flex flex-col gap-12 border-t border-border bg-surface px-6 pt-12 pb-6 lg:px-16">
      <div className="flex flex-wrap items-start justify-between gap-10">
        <div className="flex max-w-[320px] flex-col gap-6">
          <Brand height={64} />
          <p className="text-sm leading-5 text-muted-fg">
            Empowering the next generation of business leaders through AI-driven innovation and education.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {/* The design calls this Heading 5, but the pages above it stop at h2 —
              matching the design's level would skip three. */}
          <h2 className="text-base leading-6 font-bold text-fg">Company</h2>
          <ul className="flex flex-col gap-2">
            {PUBLIC_FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <FooterLinkItem link={link} />
              </li>
            ))}
            <li>
              <ContactDialog triggerClassName={cn(linkClass, "cursor-pointer")} />
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border pt-8">
        <p className="text-xs leading-[18px] text-muted-fg">{COPYRIGHT}</p>
      </div>
    </footer>
  );
}

function FooterLinkItem({ link }: { link: FooterLink }) {
  if (isExternalHref(link.href)) {
    return (
      <a href={link.href} target="_blank" rel="noreferrer" className={linkClass}>
        {link.label}
      </a>
    );
  }

  return (
    <Link href={link.href} className={linkClass}>
      {link.label}
    </Link>
  );
}
