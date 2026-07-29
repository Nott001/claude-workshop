"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "../lib/types";

interface SessionContextValue {
  user: AuthUser | null;
  loading: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
  isSignedIn: false,
  signOut: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    [],
  );

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        fetch("/api/auth/me")
          .then((r) => (r.ok ? r.json() : null))
          .then(setUser)
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetch("/api/auth/me")
          .then((r) => (r.ok ? r.json() : null))
          .then(setUser);
      } else {
        setUser(null);
      }
      router.refresh();
    });

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            fetch("/api/auth/me")
              .then((r) => (r.ok ? r.json() : null))
              .then(setUser);
          }
        });
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
  };

  return <SessionContext.Provider value={{ user, loading, isSignedIn: !!user, signOut }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
