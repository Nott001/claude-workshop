"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/components/button";
import { Form, FormField, FormLabel, FormMessage } from "@/shared/components/form";
import type { RecoverStatus } from "@/modules/auth/lib/password-reset";
import { IconInput } from "./icon-input";
import { AuthHeading } from "./auth-heading";

/**
 * Everything the route can answer that is not "sent", in the words the visitor
 * reads. Typed against the route's own union so a status added there fails the
 * build here rather than silently reaching FALLBACK_MESSAGE.
 */
const MESSAGES: Record<Exclude<RecoverStatus, "sent">, string> = {
  unknown_email: "This email is not yet registered. Check the spelling, or create an account.",
  rate_limited: "Too many reset requests. Wait about fifteen minutes and try again.",
  failed: "Something went wrong on our end. Try again in a moment.",
  delivery_failed: "The email could not be sent right now. Try again in a moment.",
  invalid_request: "Enter a valid email address.",
};

const FALLBACK_MESSAGE = "Something went wrong. Try again in a moment.";

const ERROR_ID = "forgot-email-error";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { status?: RecoverStatus; devResetUrl?: string };

      if (data.status === "sent") {
        setDevResetUrl(data.devResetUrl ?? null);
        setSubmitted(true);
      } else {
        setError((data.status && MESSAGES[data.status]) || FALLBACK_MESSAGE);
      }
    } catch {
      // A transport failure is not an answer about the address, so it must not
      // read as one — and it previously left the button stuck on "Sending…".
      setError(FALLBACK_MESSAGE);
    }

    setLoading(false);
  }

  if (submitted) {
    return (
      <div className="text-center">
        <span className="material-symbols-rounded mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-brand/10 text-3xl text-brand">
          {devResetUrl ? "link" : "mark_email_read"}
        </span>
        {devResetUrl ? (
          // The console provider (dev, no capture box) mailed no one, so the
          // screen must not claim an inbox send — the link is handed over here
          // instead, with the usual success shell so the flow reads the same.
          <>
            <AuthHeading title="Your reset link" subtitle="This build mails no one, so use the link directly." />
            <div className="mt-4 rounded-lg bg-warning/10 p-3 text-left text-xs leading-relaxed text-muted-fg">
              Development build: no email was sent. Use your reset link directly —{" "}
              <Link href={devResetUrl} prefetch={false} className="font-semibold text-brand">
                open reset page
              </Link>
              .
            </div>
          </>
        ) : (
          <>
            <AuthHeading title="Check your inbox" subtitle="The link can only be used once." />
            {/* Stated outright rather than hedged: this screen is now only reached
                once the address has been confirmed to own an account. */}
            <p className="mt-4 text-sm leading-relaxed text-muted-fg">
              We have sent a link to reset your password to <span className="font-medium text-fg">{email}</span>.
            </p>
          </>
        )}
        <p className="mt-8 text-base text-muted-fg">
          <Link href="/sign-in" prefetch={false} className="font-bold text-brand transition-colors hover:text-brand/80">
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
            // Reddens the field itself, per the convention Input already styles
            // for, and names the message so a screen reader reads the two as one.
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? ERROR_ID : undefined}
          />
        </FormField>

        {error && (
          <FormMessage id={ERROR_ID} role="alert">
            {error}
          </FormMessage>
        )}

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
        <Link href="/sign-in" prefetch={false} className="font-bold text-brand transition-colors hover:text-brand/80">
          Sign In
        </Link>
      </p>
    </div>
  );
}
