"use client";

import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import type { AuthUser } from "@/modules/auth/lib/types";
import { getInitials, useProfilePhoto } from "@/modules/shell/lib/profile";
import { cn } from "@/shared/lib/utils";

interface ProfileMenuProps {
  user: AuthUser;
  signOut: () => Promise<void>;
}

const itemClass =
  "flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-muted";

export function ProfileMenu({ user, signOut }: ProfileMenuProps) {
  const profilePhoto = useProfilePhoto(user);
  const displayName = user.full_name ?? user.email;
  const initials = getInitials(user.full_name) || (user.email?.charAt(0) ?? "?").toUpperCase();

  return (
    <Menu.Root>
      <Menu.Trigger className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted">
        {profilePhoto ? (
          <img src={profilePhoto} alt="" className="size-8 shrink-0 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white"
          >
            {initials}
          </span>
        )}
        <span className="max-w-40 truncate">{displayName}</span>
        <span aria-hidden className="material-symbols-rounded text-[16px]">
          expand_more
        </span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" side="bottom" sideOffset={8}>
          <Menu.Popup className="min-w-48 rounded-lg border border-border bg-surface p-1 text-sm text-fg shadow-lg">
            <Menu.LinkItem closeOnClick render={<Link href="/user" />} className={cn(itemClass, "text-fg")}>
              <span aria-hidden className="material-symbols-rounded text-[16px]">
                settings
              </span>
              User settings
            </Menu.LinkItem>
            <Menu.Item
              onClick={() => void signOut()}
              className={cn(itemClass, "data-highlighted:bg-error data-highlighted:text-white")}
            >
              <span aria-hidden className="material-symbols-rounded text-[16px]">
                logout
              </span>
              Sign out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
