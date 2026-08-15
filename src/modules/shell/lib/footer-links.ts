import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { ROLES } from "@/shared/lib/roles";
import type { UserRole } from "@/shared/types";

export interface FooterLink {
  label: string;
  href: string;
}

export const STARTUPLAB_SITE = "https://startuplab.ph/";

/** The design's Company column. "Contact" is not here — it opens the contact overlay. */
export const PUBLIC_FOOTER_LINKS: FooterLink[] = [{ label: "About Us", href: STARTUPLAB_SITE }];

/**
 * Facilitator and up keep the plain copyright bar; attendees, speakers and
 * visitors get the full public footer.
 */
export function usesStaffFooter(role: UserRole | null): role is UserRole {
  return hasMinRole(role, ROLES.FACILITATOR);
}

/** Anything that leaves the Next router — the footer renders these as plain anchors. */
export function isExternalHref(href: string): boolean {
  return /^(https?:|mailto:|tel:)/.test(href);
}
