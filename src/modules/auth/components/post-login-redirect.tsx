"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/modules/auth/components/session-context";
import { roleHome } from "@/modules/auth/lib/role-home";

export function PostLoginRedirect() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useSession();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => router.replace(roleHome(data?.role)))
      .catch(() => {});
  }, [isLoaded, isSignedIn, router]);

  return null;
}
