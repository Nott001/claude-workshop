"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/modules/auth/components/session-context";

const ROLE_HOME: Record<string, string> = {
  speaker: "/speaker/dashboard",
  facilitator: "/staff/events",
  admin: "/staff/events",
  super_admin: "/staff/events",
  attendee: "/home",
};

export function PostLoginRedirect() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useSession();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.role) {
          const dest = ROLE_HOME[data.role] ?? "/";
          router.replace(dest);
        }
      })
      .catch(() => {});
  }, [isLoaded, isSignedIn, router]);

  return null;
}
