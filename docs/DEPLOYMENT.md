# Deploying to Cloudflare Workers

The app runs as a single Worker, adapted from the Next.js build by
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Workers are V8
isolates, not Node processes — that constraint is why `sharp` was replaced with
`@cf-wasm/photon`, and why `nodejs_compat` is not optional in `wrangler.jsonc`.

## Files

| File                           | Purpose                                                       |
| ------------------------------ | ------------------------------------------------------------- |
| `wrangler.jsonc`               | Worker name, compatibility flags, asset binding.              |
| `open-next.config.ts`          | Adapter config. Deliberately minimal — see the comment in it. |
| `.dev.vars.example`            | Template for runtime secrets under `wrangler dev`.            |
| `.github/workflows/deploy.yml` | CD, gated on CI + Security + E2E.                             |
| `test/deploy-config.test.ts`   | Guards the invariants the deploy depends on.                  |

## Build-time vs runtime configuration

This is the distinction that breaks deploys, so it is worth stating plainly.

- **`NEXT_PUBLIC_*` is build-time.** The Next compiler inlines these strings into
  the bundle. They must be present in the environment that runs `pnpm cf:build`.
  Setting them as Worker secrets afterwards does nothing — the value is already
  baked in, as `undefined` if it was missing.
- **Everything else is runtime.** `SUPABASE_SERVICE_ROLE_KEY` is read on each
  request, so it is a Worker secret (`wrangler secret put`) and must never be
  passed to the build.

| Name                            | When    | Where it lives                                 |
| ------------------------------- | ------- | ---------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`           | build   | GitHub environment **variable** `production`   |
| `NEXT_PUBLIC_SUPABASE_URL`      | build   | GitHub environment **variable** `production`   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build   | GitHub environment **secret** `production`     |
| `SUPABASE_SERVICE_ROLE_KEY`     | runtime | `wrangler secret put`, and `.dev.vars` locally |
| `SMTP_HOST`                     | runtime | `wrangler secret put`, and `.dev.vars` locally |
| `SMTP_USER`                     | runtime | `wrangler secret put`, and `.dev.vars` locally |
| `SMTP_PASSWORD`                 | runtime | `wrangler secret put`, and `.dev.vars` locally |
| `CLOUDFLARE_API_TOKEN`          | deploy  | GitHub environment **secret** `production`     |
| `CLOUDFLARE_ACCOUNT_ID`         | deploy  | GitHub environment **secret** `production`     |

The anon key is public by design, but it is stored as a secret so it is not
printed in logs; the project URL and app URL are variables so they can be read
back and shown in the run summary.

## One-time setup

1. **Authenticate locally.**

   ```bash
   pnpm exec wrangler login
   ```

2. **Set the runtime secrets.** Per environment, once. The Worker must exist
   first, so run this after the first successful deploy — or pass
   `--name claude-workshop` to create the entry ahead of time.

   ```bash
   pnpm exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   pnpm exec wrangler secret put SMTP_HOST
   pnpm exec wrangler secret put SMTP_USER
   pnpm exec wrangler secret put SMTP_PASSWORD
   ```

   Leave the three `SMTP_*` unset and email falls back to the console provider,
   which logs instead of sending — the app still works, nothing is delivered.
   `SMTP_PORT`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`, `SMTP_REPLY_TO`,
   `SMTP_TIMEOUT_MS` and `SMTP_ATTEMPTS` are optional overrides. None of these
   may be renamed to `NEXT_PUBLIC_*`: the compiler inlines those into the client
   bundle, publishing the password.

   Auth email — sign-up confirmation and organization invites — is sent by
   Supabase, not by the worker, and is configured under **Authentication → SMTP
   Settings** in the dashboard (port 587). Two settings there are not optional:

   - **URL Configuration → Redirect URLs** must list every origin the app runs
     on. A `redirectTo` that is not on the allowlist is silently replaced by the
     Site URL with its path stripped, which sends invitees somewhere that cannot
     complete their session.
     Organization invites no longer use a Supabase template: the worker builds
     and sends that message itself, so it is edited in
     `src/shared/integrations/email/templates.ts` like the ticket emails.

   Delivery runs after the response, so a slow send costs no request latency.
   Deliverability depends on DNS the repository does not own — SPF, DKIM and
   DMARC must all pass for `startuplab.center`, or mail lands in spam however
   well-formed it is.

3. **Create the GitHub `production` environment** (Settings → Environments) and
   add the secrets and variables from the table above. Add a required reviewer
   there if deploys should need approval; the workflow needs no change for that.

4. **Create the API token** at Cloudflare → My Profile → API Tokens, from the
   _Edit Cloudflare Workers_ template. Scope it to this account only.

5. **Point the domain at the Worker.** Add a route to `wrangler.jsonc`:

   ```jsonc
   "routes": [{ "pattern": "events.example.com", "custom_domain": true }]
   ```

   Then update `NEXT_PUBLIC_APP_URL` to that origin **and** add it to Supabase's
   auth redirect allowlist (Authentication → URL Configuration). Sign-in
   silently redirects to the wrong host otherwise. `NEXT_PUBLIC_APP_URL` is
   currently an ngrok tunnel used for local webhook testing — it must not reach
   production.

## Deploying

Merging to `main` is the deploy. `deploy.yml` waits for CI, Security and E2E to
finish on that commit, then builds and uploads. Nothing else triggers it: there
is no `push` trigger, because a push-triggered deploy outruns the checks.

Manual dispatch is available for rollbacks, with a `skip_gate` input that
bypasses verification and logs a warning when used.

## Local preview

`pnpm dev` remains the loop for iterating — it is Node, and it is fast. Use the
Worker preview to answer a narrower question: _does this run in an isolate?_

```bash
cp .dev.vars.example .dev.vars   # then fill it in
pnpm cf:preview                  # builds, then serves on workerd
```

Passing vitest does not answer that question. Vitest resolves `@cf-wasm/photon`
through vite's `node` condition; only `workerd` exercises the `workerd` one.

## Scripts

| Script            | What it does                                                  |
| ----------------- | ------------------------------------------------------------- |
| `pnpm cf:build`   | Next build, adapted into `.open-next/`.                       |
| `pnpm cf:preview` | Build, then serve on the real runtime.                        |
| `pnpm cf:deploy`  | Build and upload. CI does this; run it locally only to debug. |
| `pnpm cf:typegen` | Regenerate `cloudflare-env.d.ts` from `wrangler.jsonc`.       |

`cloudflare-env.d.ts` is gitignored **and excluded from `tsconfig.json`**, for
two separate reasons:

- `wrangler types` derives it from the local `.env`/`.dev.vars` as well as from
  the config, so a committed copy would encode one developer's machine.
- It carries workerd's runtime lib, which redeclares `fetch` and `Response`
  against the DOM's. With it in scope every `res.json()` in `src/` degrades to
  `unknown` and `pnpm typecheck` fails in a dozen untouched files.

So it is a reference artefact today, not a type source. When code actually needs
`getCloudflareContext()`, give the worker-facing files their own tsconfig that
includes it rather than putting it back into the app's.

## Rollback

```bash
pnpm exec wrangler deployments list
pnpm exec wrangler rollback [<version-id>]
```

A rollback reverts the code only. A migration that shipped alongside it stays
applied — the previous bundle has to still work against the current schema, which
is the usual argument for additive migrations.

## What is deliberately not configured

Each of these welds the app to Cloudflare, and none is load-bearing yet. The
reasons are recorded in `wrangler.jsonc` next to where they would go:

- **R2 incremental cache and `WORKER_SELF_REFERENCE`** — nothing is
  incrementally regenerated, so the cache would hold nothing.
- **The `images` binding** — no component imports `next/image` yet.
- **Durable Objects, KV, Cron Triggers** — no need has appeared.

Uploads are resized in-process by photon and stored in Supabase Storage, both
host-independent. If the host ever changes, `optimizeImage` keeps a `File → File`
signature and the swap is one file plus a dependency.
