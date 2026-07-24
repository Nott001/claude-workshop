"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

const ROLE_HOME: Record<string, string> = {
  speaker: "/speakers/dashboard",
  facilitator: "/events",
  attendee: "/home",
};

export function PostLoginRedirect() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

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
