"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/shared/components/button";
import { Form, FormField, FormLabel, FormMessage } from "@/shared/components/form";
import { redirectUrlParam } from "@/modules/auth/lib/redirect-url";
import { withBackLink, type BackLinkOrigin } from "@/shared/lib/back-link";
import { resolvePostSignInDestination } from "@/modules/auth/lib/post-sign-in-destination";
import { IconInput } from "./icon-input";
import { PasswordInput } from "./password-input";
import { AuthHeading } from "./auth-heading";

export function SignInForm({ redirectUrl = null, backOrigin }: { redirectUrl?: string | null; backOrigin?: BackLinkOrigin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    window.location.assign(await resolvePostSignInDestination(redirectUrl));
  }

  return (
    <div>
      <AuthHeading title="Welcome Back" subtitle="Please enter your details to sign in." />

      <Form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <FormField>
          <FormLabel htmlFor="signin-email" className="text-sm font-medium tracking-wider text-fg">
            Email address
          </FormLabel>
          <IconInput
            id="signin-email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </FormField>

        <FormField>
          <div className="flex items-center justify-between gap-2">
            <FormLabel htmlFor="signin-password" className="text-sm font-medium tracking-wider text-fg">
              Password
            </FormLabel>
            <Link
              href={withBackLink("/forgot-password", backOrigin)}
              // Reaching for it means the sign-in attempt already failed, so
              // rendering it in advance for everyone spends the many to save
              // the few. It was one of the killed requests in the capture.
              prefetch={false}
              className="text-sm font-medium tracking-wider text-brand transition-colors hover:text-brand/80"
            >
              Forgot Password?
            </Link>
          </div>
          <PasswordInput
            id="signin-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </FormField>

        {error && <FormMessage role="alert">{error}</FormMessage>}

        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full gap-2 text-base font-semibold shadow-lg shadow-brand/20"
        >
          {loading ? "Signing in…" : "Sign In"}
          {!loading && (
            <span aria-hidden className="material-symbols-rounded text-[18px]">
              arrow_forward
            </span>
          )}
        </Button>
      </Form>

      <p className="mt-8 text-center text-base text-muted-fg">
        Don&apos;t have an account?{" "}
        <Link
          href={withBackLink(`/sign-up${redirectUrlParam(redirectUrl)}`, backOrigin)}
          // Both the origin and the redirect ride in the query string, so this
          // prefetches a URL unique to wherever the visitor came from — a
          // render that can never be reused. It was killed in the capture.
          prefetch={false}
          className="font-bold text-brand transition-colors hover:text-brand/80"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
