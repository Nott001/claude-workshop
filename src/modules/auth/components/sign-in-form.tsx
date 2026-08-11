"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/shared/components/button";
import { Input } from "@/shared/components/input";
import { Form, FormField, FormLabel, FormMessage } from "@/shared/components/form";
import { redirectUrlParam } from "@/modules/auth/lib/redirect-url";

export function SignInForm({ redirectUrl = null }: { redirectUrl?: string | null }) {
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

    window.location.assign(redirectUrl ?? "/events");
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <span className="material-symbols-rounded mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
          lock_open
        </span>
        <h1 className="text-xl font-bold text-fg">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-fg">Sign in to your account to continue.</p>
      </div>

      <Form onSubmit={handleSubmit} className="space-y-4">
        <FormField>
          <FormLabel htmlFor="signin-email">Email</FormLabel>
          <Input
            id="signin-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>

        <FormField>
          <div className="flex items-center justify-between">
            <FormLabel htmlFor="signin-password">Password</FormLabel>
            <Link href="/forgot-password" className="text-xs text-muted-fg hover:text-fg transition-colors">
              Forgot password?
            </Link>
          </div>
          <Input
            id="signin-password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormField>

        {error && <FormMessage>{error}</FormMessage>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in\u2026" : "Sign in"}
        </Button>
      </Form>

      <p className="mt-6 text-center text-sm text-muted-fg">
        Don&apos;t have an account?{" "}
        <Link
          href={`/sign-up${redirectUrlParam(redirectUrl)}`}
          className="font-medium text-brand hover:text-brand/80 transition-colors"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
