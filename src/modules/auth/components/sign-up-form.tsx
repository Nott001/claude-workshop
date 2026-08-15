"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/shared/components/button";
import { Form, FormField, FormLabel, FormMessage } from "@/shared/components/form";
import { redirectUrlParam } from "@/modules/auth/lib/redirect-url";
import { withBackLink, type BackLinkOrigin } from "@/shared/lib/back-link";
import { VerifyEmailCard } from "./verify-email-card";
import { IconInput } from "./icon-input";
import { PasswordInput } from "./password-input";
import { PasswordRequirements } from "./password-requirements";
import { evaluatePassword, MIN_PASSWORD_LENGTH } from "@/shared/lib/password-policy";

const CONFIRM_ERROR_ID = "signup-confirm-error";
const TERMS_ERROR_ID = "signup-terms-error";

const labelClass = "text-sm font-medium tracking-wider text-fg";

export function SignUpForm({ redirectUrl = null, backOrigin }: { redirectUrl?: string | null; backOrigin?: BackLinkOrigin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [fullName, setFullName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsRejected, setTermsRejected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const confirmRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLInputElement>(null);

  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  // Withheld until the field has been left once, because a confirmation half
  // typed differs from the password by definition and saying so is noise. After
  // that it tracks every keystroke, so the fix is acknowledged as it is made.
  const mismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const showMismatch = confirmTouched && mismatch;
  const showTermsError = termsRejected && !acceptedTerms;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Checked here as well as by the provider so the reason is the specific
    // unmet rule rather than the generic refusal an auth error carries.
    const verdict = evaluatePassword(password, { email, fullName });
    if (!verdict.ok) {
      setError(verdict.problem);
      return;
    }

    if (password !== confirmPassword) {
      setConfirmTouched(true);
      confirmRef.current?.focus();
      return;
    }

    // Stated in the page rather than left to the browser's bubble on a
    // `required` checkbox: consent that was refused should say so where the
    // consent is, and a bubble is gone by the time the eye reaches it.
    if (!acceptedTerms) {
      setTermsRejected(true);
      termsRef.current?.focus();
      return;
    }

    setLoading(true);

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

  if (submitted)
    return (
      <Card>
        <VerifyEmailCard email={email} redirectUrl={redirectUrl} />
      </Card>
    );

  return (
    <Card>
      <div>
        <h2 className="text-[2rem] leading-10 font-semibold tracking-[-0.01em] text-fg">Create an account</h2>
        <p className="mt-1 text-base text-muted-fg">Start your entrepreneurial journey today.</p>
      </div>

      <Form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <FormField>
          <FormLabel htmlFor="signup-name" className={labelClass}>
            Full Name
          </FormLabel>
          <IconInput
            icon="person"
            id="signup-name"
            type="text"
            placeholder="John Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </FormField>

        <FormField>
          <FormLabel htmlFor="signup-email" className={labelClass}>
            Email address
          </FormLabel>
          <IconInput
            icon="mail"
            id="signup-email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField>
            <FormLabel htmlFor="signup-password" className={labelClass}>
              Password
            </FormLabel>
            {/* Both fields are half-width, so the placeholder is the design's
                dots rather than prose that would arrive truncated. The rule
                itself is stated by the checklist below. */}
            <PasswordInput
              icon="lock"
              id="signup-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
            />
          </FormField>

          <FormField>
            <FormLabel htmlFor="signup-confirm-password" className={labelClass}>
              Confirm Password
            </FormLabel>
            <PasswordInput
              icon="lock_reset"
              ref={confirmRef}
              id="signup-confirm-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => setConfirmTouched(true)}
              required
              autoComplete="new-password"
              aria-invalid={showMismatch || undefined}
              aria-describedby={showMismatch ? CONFIRM_ERROR_ID : undefined}
            />
          </FormField>
        </div>

        {/* Full width and always occupying its line, because this message
            arrives on the same click that reaches for whatever is under it:
            the field blurs, the message appears, and anything below jumps by
            its height. Inside the half-width cell it wrapped to two lines and
            moved the consent checkbox 46px mid-click, so the click that
            summoned it landed on nothing. */}
        <div className="min-h-5">
          {showMismatch && (
            <FormMessage id={CONFIRM_ERROR_ID} role="alert">
              Those passwords do not match.
            </FormMessage>
          )}
        </div>

        <PasswordRequirements password={password} context={{ email, fullName }} />

        <FormField>
          <div className="flex items-start gap-3 py-2">
            <input
              ref={termsRef}
              id="signup-terms"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => {
                setAcceptedTerms(e.target.checked);
                if (e.target.checked) setTermsRejected(false);
              }}
              aria-invalid={showTermsError || undefined}
              aria-describedby={showTermsError ? TERMS_ERROR_ID : undefined}
              className="mt-0.5 size-5 shrink-0 rounded-sm border-border accent-brand focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none aria-[invalid=true]:outline aria-[invalid=true]:outline-error"
            />
            <label htmlFor="signup-terms" className="text-sm leading-5 font-medium tracking-wider text-muted-fg">
              I agree to the{" "}
              <Link href="/terms" className="text-brand transition-colors hover:text-brand/80">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-brand transition-colors hover:text-brand/80">
                Privacy Policy
              </Link>
            </label>
          </div>
          {showTermsError && (
            <FormMessage id={TERMS_ERROR_ID} role="alert">
              Please accept the Terms of Service and Privacy Policy to continue.
            </FormMessage>
          )}
        </FormField>

        {error && <FormMessage role="alert">{error}</FormMessage>}

        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full text-sm font-bold tracking-wider shadow-lg shadow-brand/20"
        >
          {loading ? "Creating account…" : "Sign Up"}
        </Button>

        <div className="relative flex items-center justify-center py-2">
          <span aria-hidden className="absolute inset-x-0 top-1/2 border-t border-border/30" />
          <span className="relative bg-surface px-2 text-sm font-medium tracking-wider text-muted-fg">Already a member?</span>
        </div>

        {/* Styled as a button but left a link, because it navigates: routed
            through Button it would either claim native button semantics it does
            not have, or take Base UI's role="button" and stop being announced
            as the link it is. */}
        <Link
          href={withBackLink(`/sign-in${redirectUrlParam(redirectUrl)}`, backOrigin)}
          className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-border bg-surface text-sm font-medium tracking-wider text-fg shadow-lg shadow-brand/20 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Sign In
        </Link>
      </Form>
    </Card>
  );
}

/** The frosted panel the form and its post-submit confirmation both sit in. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-surface/80 p-8 shadow-sm backdrop-blur-[6px] sm:p-10">{children}</div>
  );
}
