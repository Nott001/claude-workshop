"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/components/button";
import { Form, FormField, FormLabel } from "@/shared/components/form";
import { IconInput } from "./icon-input";
import { AuthHeading } from "./auth-heading";

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
      <div className="text-center">
        <span className="material-symbols-rounded mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-brand/10 text-3xl text-brand">
          mark_email_read
        </span>
        <AuthHeading title="Check your inbox" subtitle="The link can only be used once." />
        <p className="mt-4 text-sm leading-relaxed text-muted-fg">
          If an account exists for <span className="font-medium text-fg">{email}</span>, we have sent a link to reset its
          password.
        </p>
        <p className="mt-8 text-base text-muted-fg">
          <Link href="/sign-in" className="font-bold text-brand transition-colors hover:text-brand/80">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <AuthHeading title="Reset your password" subtitle="We will send you a link to choose a new one." />

      <Form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <FormField>
          <FormLabel htmlFor="forgot-email" className="text-sm font-medium tracking-wider text-fg">
            Email address
          </FormLabel>
          <IconInput
            id="forgot-email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </FormField>

        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full gap-2 text-base font-semibold shadow-lg shadow-brand/20"
        >
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </Form>

      <p className="mt-8 text-center text-base text-muted-fg">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-bold text-brand transition-colors hover:text-brand/80">
          Sign In
        </Link>
      </p>
    </div>
  );
}
