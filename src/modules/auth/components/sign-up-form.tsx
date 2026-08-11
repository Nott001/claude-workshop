"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/shared/components/button";
import { Input } from "@/shared/components/input";
import { Form, FormField, FormLabel, FormMessage } from "@/shared/components/form";
import { redirectUrlParam } from "@/modules/auth/lib/redirect-url";
import { VerifyEmailCard } from "./verify-email-card";

export function SignUpForm({ redirectUrl = null }: { redirectUrl?: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/api/auth/callback${redirectUrlParam(redirectUrl)}`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) return <VerifyEmailCard email={email} redirectUrl={redirectUrl} />;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <span className="material-symbols-rounded mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
          person_add
        </span>
        <h1 className="text-xl font-bold text-fg">Create your account</h1>
        <p className="mt-1 text-sm text-muted-fg">Join StartupLab and start your journey.</p>
      </div>

      <Form onSubmit={handleSubmit} className="space-y-4">
        <FormField>
          <FormLabel htmlFor="signup-name">Full name</FormLabel>
          <Input
            id="signup-name"
            type="text"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </FormField>

        <FormField>
          <FormLabel htmlFor="signup-email">Email</FormLabel>
          <Input
            id="signup-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>

        <FormField>
          <FormLabel htmlFor="signup-password">Password</FormLabel>
          <Input
            id="signup-password"
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </FormField>

        {error && <FormMessage>{error}</FormMessage>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating account\u2026" : "Create account"}
        </Button>
      </Form>

      <p className="mt-6 text-center text-sm text-muted-fg">
        Already have an account?{" "}
        <Link
          href={`/sign-in${redirectUrlParam(redirectUrl)}`}
          className="font-medium text-brand hover:text-brand/80 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
