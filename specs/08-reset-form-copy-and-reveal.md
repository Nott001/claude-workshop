# 08 — Reset form: delivery-failed copy and the dev link callout

## Goal

Give the forgot-password form words for the new `delivery_failed` status, and render the minted URL when the route hands one back (the dev console fallback), so a reset still completes without a capture box configured.

## Where

- `src/modules/auth/components/forgot-password-form.tsx`
- `test/forgot-password-form.test.tsx`

## Why

The form maps every non-`sent` status to copy (`MESSAGES`, keyed by `Exclude<RecoverStatus, "sent">`), so once sheet 06 adds `delivery_failed` to the union, TypeScript refuses to build until this sheet supplies words for it — the shared-type design working as intended. And when sheet 07 returns a `devResetUrl`, the "Check your inbox" screen would otherwise claim mail that was never sent; the callout says so and hands over the link instead.

## Steps

1. In `forgot-password-form.tsx`:

   a) Add the message. The `Record` type you are required to satisfy is `Record<Exclude<RecoverStatus, "sent">, string>`:

   ```ts
   const MESSAGES: Record<Exclude<RecoverStatus, "sent">, string> = {
     unknown_email: "This email is not yet registered. Check the spelling, or create an account.",
     rate_limited: "Too many reset requests. Wait about fifteen minutes and try again.",
     failed: "Something went wrong on our end. Try again in a moment.",
     delivery_failed: "The email could not be sent right now. Try again in a moment.",
     invalid_request: "Enter a valid email address.",
   };
   ```

   b) Track the dev link in state and read it from the reply:

   ```ts
   const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
   ...
   const data = (await res.json()) as { status?: RecoverStatus; devResetUrl?: string };
   if (data.status === "sent") {
     setDevResetUrl(data.devResetUrl ?? null);
     setSubmitted(true);
   } else {
     setError(...);
   }
   ```

   c) Render the success screen in one of two shapes. With a `devResetUrl` the
   screen must not claim an inbox send alongside the handover — "We have sent a
   link" directly above "no email was sent" is the same lie as `delivery_failed`,
   prettier — so the heading, the mail paragraph and the callout all branch:

   ```tsx
   {
     devResetUrl ? (
       <>
         {/* The dev console provider mailed no one, so the usual success shell is
           replaced by a direct handover rather than claiming an inbox send. */}
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
         <p className="mt-4 text-sm leading-relaxed text-muted-fg">
           We have sent a link to reset your password to <span className="font-medium text-fg">{email}</span>.
         </p>
       </>
     );
   }
   ```

   `Link` is already imported. Callout and icon use the theme's `warning` token
   (`bg-warning/10`) — there is no `warn` colour in `globals.css`, so `bg-warn/10`
   would emit nothing and render invisible. The dev shape renders only when the
   route included the field, which only the console provider does.

2. In `test/forgot-password-form.test.tsx`, let the stub carry extra fields and cover the two new behaviours:

   a) Extend the responder:

   ```ts
   function respondWith(status: string, extra: Record<string, string> = {}) {
     const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status, ...extra }) });
     vi.stubGlobal("fetch", fetchMock);
     return fetchMock;
   }
   ```

   b) Add to the suite:

   ```ts
   it("explains a delivery failure instead of claiming a send", async () => {
     respondWith("delivery_failed");

     render(<ForgotPasswordForm />);
     submit("member@example.com");

     const alert = await screen.findByRole("alert");
     expect(alert.textContent).toMatch(/could not be sent right now/i);
     expect(screen.queryByText("Check your inbox")).toBeNull();
   });
   ```

it("shows the reset link when the route returns one for dev", async () => {
respondWith("sent", { devResetUrl: "http://localhost:3000/reset-password?token=abc" });

      render(<ForgotPasswordForm />);
      submit("member@example.com");

      const link = await screen.findByRole("link", { name: /open reset page/i });
      expect(link.getAttribute("href")).toBe("http://localhost:3000/reset-password?token=abc");
    });

    it("does not claim a sent inbox mail when it hands back a dev link", async () => {
      respondWith("sent", { devResetUrl: "http://localhost:3000/reset-password?token=abc" });

      render(<ForgotPasswordForm />);
      submit("member@example.com");

      await screen.findByRole("link", { name: /open reset page/i });
      expect(screen.queryByText(/we have sent a link to reset your password/i)).toBeNull();
      expect(screen.queryByText("Check your inbox")).toBeNull();
    });

    it("stays quiet about a link when the route returned none", async () => {
      respondWith("sent");

      render(<ForgotPasswordForm />);
      submit("member@example.com");

      await screen.findByText("Check your inbox");
      expect(screen.queryByRole("link", { name: /open reset page/i })).toBeNull();
    });
    ```

## Definition of done

- `pnpm typecheck` passes with the new `RecoverStatus` member (the form covers every non-`sent` status).
- `delivery_failed` reads as a send problem, never as "not registered".
- The success screen shows the reset link only when the route supplied one.
- `pnpm test forgot-password-form` is green.

## Verify

```sh
pnpm test forgot-password-form
pnpm typecheck
```
