import type { UserRole } from "@/shared/types";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export const ROLE_NAV_ITEMS: Partial<Record<UserRole, NavItem[]>> = {
  attendee: [
    { label: "Home", href: "/", icon: "home" },
    { label: "Events", href: "/events", icon: "event" },
    { label: "Community", href: "/community", icon: "forum" },
    { label: "Tickets", href: "/tickets", icon: "confirmation_number" },
    // Courses released by events already attended hang off no event the
    // reader would think to open, so the library needs its own way in.
    { label: "Courses", href: "/courses", icon: "school" },
  ],
  speaker: [
    { label: "My Events", href: "/speaker/events", icon: "event" },
    { label: "Community", href: "/community", icon: "forum" },
  ],
  facilitator: [
    { label: "My Events", href: "/staff/events/assigned", icon: "event" },
    { label: "Community", href: "/community", icon: "forum" },
  ],
  admin: [
    { label: "Events", href: "/staff/events", icon: "event" },
    { label: "Users", href: "/staff/users", icon: "groups" },
    { label: "Community", href: "/staff/community", icon: "forum" },
    { label: "Emails", href: "/staff/emails", icon: "mail" },
    { label: "Support", href: "/staff/support", icon: "support_agent" },
    { label: "Audit Logs", href: "/staff/audit-logs", icon: "history" },
  ],
  super_admin: [
    { label: "Events", href: "/staff/events", icon: "event" },
    { label: "Users", href: "/staff/users", icon: "groups" },
    { label: "Community", href: "/staff/community", icon: "forum" },
    { label: "Emails", href: "/staff/emails", icon: "mail" },
    { label: "Support", href: "/staff/support", icon: "support_agent" },
    { label: "Audit Logs", href: "/staff/audit-logs", icon: "history" },
  ],
};

export const GUEST_NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Events", href: "/events", icon: "event" },
  { label: "Community", href: "/community", icon: "forum" },
];

/** The nav set for a layout, falling back to the attendee set for any role the map does not know. */
export function getNavItems(isSignedIn: boolean, role: UserRole): NavItem[] {
  return isSignedIn ? (ROLE_NAV_ITEMS[role] ?? ROLE_NAV_ITEMS.attendee!) : GUEST_NAV_ITEMS;
}
