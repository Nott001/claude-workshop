"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

interface CurrentUser {
  id: number;
  role: string;
  full_name?: string;
}

export function useCurrentUser() {
  const { isLoaded, isSignedIn } = useUser();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [userFetched, setUserFetched] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .finally(() => setUserFetched(true));
  }, [isLoaded, isSignedIn]);

  const loading = !isLoaded || (isSignedIn && !userFetched);

  return { user, loading, isSignedIn: !!isSignedIn };
}
