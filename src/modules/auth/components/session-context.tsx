"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser } from "../lib/types";

interface SessionContextValue {
  user: AuthUser | null;
  loading: boolean;
  /**
   * `!loading`. Provided because consumers kept reaching for it by destructuring
   * `loading` *as* `isLoaded`, which silently inverts the flag: every
   * `if (!isLoaded) return` then bailed out precisely when the session was ready
   * and ran only while it was not, so the fetch behind it never happened and the
   * page span forever. Read this instead of renaming `loading`.
   */
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
  /**
   * Merges fields into the cached user after a write elsewhere has already
   * persisted them. Everything chrome-level reads its copy of the user from
   * here — the navbar name and initials, the home greeting — so without this
   * an edit stayed invisible until the next refetch, which only a reload, a
   * tab switch or an auth event triggers.
   */
  updateUser: (patch: Partial<AuthUser>) => void;
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
  isLoaded: false,
  isSignedIn: false,
  signOut: async () => {},
  updateUser: () => {},
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
      // `loading` gates every guarded page, so it has to be cleared on the
      // failing paths too. A rejected getSession — a corrupt stored session, a
      // refresh that cannot reach the auth server — left it set with no second
      // chance, and the page it was gating spun until a reload.
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;

        const res = await fetch("/api/auth/me");
        setUser(res.ok ? await res.json() : null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        fetch("/api/auth/me")
          .then((r) => (r.ok ? r.json() : null))
          .then(setUser);
        router.refresh();
        return;
      }

      setUser(null);
      // Only a real sign-out navigates. Refreshing in place would re-request the
      // current route without a session, and on a guarded one the middleware
      // answers that with a sign-in redirect that races the trip home. The event
      // check matters: subscribing emits INITIAL_SESSION with a null session, so
      // reacting to "no session" alone would bounce every anonymous visitor.
      if (event === "SIGNED_OUT") router.replace("/");
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

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    // replace, not push: the guarded page we are leaving must not sit one Back
    // press away from a browser that no longer holds a session.
    router.replace("/");
  }, [supabase, router]);

  // Memoised so a re-render that leaves the session untouched does not hand
  // every consumer a new object and repaint the whole shell with it.
  const value = useMemo<SessionContextValue>(
    () => ({ user, loading, isLoaded: !loading, isSignedIn: !!user, signOut, updateUser }),
    [user, loading, signOut, updateUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
