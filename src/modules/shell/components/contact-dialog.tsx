"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/dialog";

interface ContactDetail {
  icon: string;
  label: string;
  lines: string[];
  /** Applied to the first line only — the rest is address or hours copy. */
  href?: string;
}

const CONTACT_DETAILS: ContactDetail[] = [
  { icon: "mail", label: "Email", lines: ["hello@startuplab.ph"], href: "mailto:hello@startuplab.ph" },
  { icon: "call", label: "Phone", lines: ["+63 917 715 2587"], href: "tel:+639177152587" },
  {
    icon: "location_on",
    label: "Address",
    lines: ["2nd Floor Pearl Plaza Building", "7001 Felix Avenue, Barangay Navarro", "General Trias, Cavite, Philippines"],
  },
  {
    icon: "schedule",
    label: "Office Hours",
    lines: ["Monday – Friday: 9:00 AM – 6:00 PM", "Saturday – Sunday: Closed"],
  },
];

export function ContactDialog({ triggerClassName }: { triggerClassName?: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<button type="button" className={triggerClassName} />}>Contact</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base leading-6 font-bold text-fg">Contact Information</DialogTitle>
        </DialogHeader>
        <dl className="mt-5 flex flex-col gap-5">
          {CONTACT_DETAILS.map((detail) => (
            <div key={detail.label} className="flex gap-3">
              <span aria-hidden className="material-symbols-rounded text-[20px] text-brand">
                {detail.icon}
              </span>
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-semibold tracking-wider text-muted-fg uppercase">{detail.label}</dt>
                <dd className="flex flex-col text-sm leading-5 text-fg">
                  {detail.href ? (
                    <a href={detail.href} className="w-fit transition-colors hover:text-brand">
                      {detail.lines[0]}
                    </a>
                  ) : (
                    detail.lines.map((line) => <span key={line}>{line}</span>)
                  )}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
