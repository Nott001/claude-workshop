"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/shared/components/button";

export function VerifyEmailCard({ email }: { email: string }) {
  const [resent, setResent] = useState(false);
  const [sending, setSending] = useState(false);

  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  async function handleResend() {
    setSending(true);
    setResent(false);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    });

    if (!error) setResent(true);
    setSending(false);
  }

  return (
    <div className="w-full max-w-sm text-center">
      <span className="material-symbols-rounded mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-brand/10 text-3xl text-brand">
        mark_email_unread
      </span>
      <h1 className="text-xl font-bold text-fg">Check your email</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-fg">
        We sent a verification link to <span className="font-medium text-fg">{email}</span>
      </p>
      <p className="mt-1 text-sm leading-relaxed text-muted-fg">
        Click the link in the email to verify your account and get started.
      </p>

      <div className="mt-8 space-y-3">
        <Button onClick={handleResend} disabled={sending || resent} variant="secondary" className="w-full">
          {sending ? "Sending\u2026" : resent ? "Email sent" : "Resend email"}
        </Button>

        <p className="text-sm text-muted-fg">
          <Link href="/sign-in" className="font-medium text-brand hover:text-brand/80 transition-colors">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
