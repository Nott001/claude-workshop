"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/components/button";
import { Input } from "@/shared/components/input";
import { Form, FormField, FormLabel } from "@/shared/components/form";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await fetch("/api/auth/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    // Shown whatever happened. The endpoint deliberately cannot tell us whether
    // the address owns an account, and echoing a difference here would undo
    // that: this screen would become the enumeration oracle instead.
    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <div className="w-full max-w-sm text-center">
        <span className="material-symbols-rounded mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-brand/10 text-3xl text-brand">
          mark_email_read
        </span>
        <h1 className="text-xl font-bold text-fg">Check your inbox</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-fg">
          If an account exists for <span className="font-medium text-fg">{email}</span>, we have sent a link to reset its
          password. The link can only be used once.
        </p>
        <p className="mt-6 text-sm text-muted-fg">
          <Link href="/sign-in" className="font-medium text-brand hover:text-brand/80 transition-colors">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <span className="material-symbols-rounded mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
          lock_reset
        </span>
        <h1 className="text-xl font-bold text-fg">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-fg">Enter your email and we will send you a link to choose a new one.</p>
      </div>

      <Form onSubmit={handleSubmit} className="space-y-4">
        <FormField>
          <FormLabel htmlFor="forgot-email">Email</FormLabel>
          <Input
            id="forgot-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </Form>

      <p className="mt-6 text-center text-sm text-muted-fg">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-medium text-brand hover:text-brand/80 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
