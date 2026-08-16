# 01 — Branch and baseline

## Goal

Work off a clean, short-lived branch and confirm the app runs — and that the reset-email flaw reproduces — before touching any code.

## Why

The email seam (`src/shared/integrations/email/index.ts`) returns the console provider under `next dev`, so a password-reset request answers `"sent"` and the link only reaches the dev-server terminal. The route cannot know delivery succeeded because it never awaited it (`src/app/api/auth/recover/route.ts:45`). These sheets fix the transport so dev mail really lands in inbucket, then make the reset route report that truthfully.

## Steps

1. Create the branch for the whole effort:

   ```sh
   git checkout -b fix/reset-password-email
   ```

2. Confirm the working tree is clean:

   ```sh
   git status
   ```

3. Confirm the local capture box is up. With Docker running:

   ```sh
   pnpm db:status
   ```

   inbucket's SMTP inbound is the host-published port **54325**; its web UI is **54324** (`docs/LOCAL_DB.md`).

4. Start the dev server and leave it running for the following sheets:

   ```sh
   pnpm dev
   ```

5. Reproduce the flaw. Visit `/sign-in` → **Forgot Password?** → submit a seeded account's email (e.g. `attendee@example.com`, per `docs/LOCAL_DB.md`). The form answers **Check your inbox**; inbucket (54324) shows nothing. The reset link is only printed to the dev-server terminal by `ConsoleEmailProvider`.

6. Read the files on the chopping block so the edits later stay small and single-purpose:

   - `src/shared/integrations/email/index.ts`
   - `src/shared/integrations/email/providers/smtp/{session,config,socket}.ts`
   - `src/modules/auth/lib/password-reset.ts`
   - `src/app/api/auth/recover/route.ts`
   - `src/modules/auth/components/forgot-password-form.tsx`
   - `src/modules/user/components/password-section.tsx`

## Definition of done

- On branch `fix/reset-password-email`.
- `pnpm dev` is up and inbucket is reachable; a reset request reproduces the missing-mail symptom.
- No product code changed in this sheet.

## Verify

```sh
git status          # clean, on the new branch
curl -s http://127.0.0.1:54324 > /dev/null && echo "inbucket up"
```
