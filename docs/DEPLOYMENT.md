# Deploying to Cloudflare Workers

The app runs as a single Worker, adapted from the Next.js build by
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Workers are V8
isolates, not Node processes — that constraint is why `sharp` could not come
along, and why `nodejs_compat` is not optional in `wrangler.jsonc`. Its
WebAssembly replacement did not survive either: workerd compiles WebAssembly
only at startup, and no Next bundler will hand the module to wrangler instead,
so images are now resized by the browser before they are uploaded.

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

### Env files, and which host reads them

| File                                   | Who reads it                                                 | What's in it                                               | Git       | Prod counterpart                     |
| -------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- | --------- | ------------------------------------ |
| `.env`                                 | `next dev`, `next build` (i.e. the local `cf:preview` build) | App env for local runs; Supabase target owned by `db:env`  | ignored   | GitHub `production` env (build-time) |
| `.env.remote`                          | `db:env remote` (merged into `.env`)                         | Hosted-project Supabase block, for local work on real data | ignored   | none (a local dev tool)              |
| `.env.local`                           | Next, ahead of `.env`                                        | Per-developer overrides                                    | ignored   | none                                 |
| `.dev.vars`                            | `wrangler dev` / `cf:preview`                                | Runtime secrets for the local isolate (SMTP, service key)  | ignored   | Cloudflare Worker secrets            |
| `.env.example` / `.env.remote.example` | humans (templates)                                           | Placeholders only                                          | committed | —                                    |

Nothing deployed is ever read from a local file: prod build-time values come
from the GitHub `production` environment at deploy, and prod runtime secrets
are Worker secrets in Cloudflare. The files above only shape local `dev` and
`cf:preview`. Two of them carry the same runtime secrets
(`SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASSWORD`): `.env` for `next dev` and
`.dev.vars` for the workerd preview — keep them in step, since a change to one
is invisible to the other.

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

   Leave the three `SMTP_*` unset and the Worker refuses to send rather than
   pretending to: `EMAIL_LOG` records `failed` and an invite answers `502`.
   That is deliberate. Reporting success for mail that never left the isolate
   is how these three secrets stayed unset here for weeks while every invitation
   read as delivered. `next dev` only ever dials a loopback capture box — a
   remote host there never reaches a real relay, and when the app targets the
   local Supabase stack the seam routes to the same inbucket GoTrue's own mail
   uses, so dev needs no SMTP configuration at all.
   `SMTP_PORT`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`, `SMTP_REPLY_TO`,
   `SMTP_TIMEOUT_MS`, `SMTP_ATTEMPTS` and `SMTP_SECURE` are optional overrides.
   `SMTP_SECURE` defaults to plaintext when `SMTP_HOST` is loopback and to
   implicit TLS otherwise, so a local capture box needs no extra setting and a
   remote relay is never sent a password unencrypted by accident. None of these
   may be renamed to `NEXT_PUBLIC_*`: the compiler inlines those into the client
   bundle, publishing the password.

   Two senders exist, and which one is responsible decides where a fix goes:

   - **The worker** sends ticket, check-in, user-invite **and
     password-recovery** mail through the `SMTP_*` mailbox above. Recovery mints
     its link through GoTrue's admin API but emails it from here with the same
     branded template as the invitation — which is why its template lives with
     the others in `src/shared/integrations/email/`.
   - **Supabase** sends sign-up confirmation and email-change mail from its own
     servers, configured under **Authentication → SMTP Settings** (port 587).
     Those templates exist only in the dashboard.

   **URL Configuration → Redirect URLs** must list every origin the app runs on.
   A `redirectTo` absent from that allowlist is silently replaced by the Site URL
   with its path stripped, which strands anyone following an emailed link.

   Ticket and check-in delivery runs after the response, so a slow send costs no
   request latency. Invites and password recovery are awaited instead: the
   requester has to be told the mail did not go out. A set of `SMTP_*` values
   that still reach no server (e.g. the loopback capture box is down in dev)
   shows up as a `delivery_failed` reply from the recovery route.
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
bypasses verification and logs a warning when used. Dispatching it against a
branch deploys that branch's HEAD, built with the `production` environment, so
it is also the way to ship a branch without merging — the gate is skipped, the
configuration is not.

### Never run `pnpm cf:deploy` against production

It builds from whatever the shell can see, which on a workstation is
`.env.local`. Every `NEXT_PUBLIC_*` in that file is inlined into the bundle by
the compiler — including `NEXT_PUBLIC_SUPABASE_URL`, which points at the local
Supabase on `127.0.0.1:54321`.

The upload succeeds and the Worker starts. What fails is every query: the
isolate resolves a loopback address, `global_fetch_strictly_public` sends it out
to the public internet, and Cloudflare answers `1003 — direct IP access not
allowed`. Pages still return `200`, because the DAOs log the error and return
`[]`, so the landing page renders "No upcoming events" and the community list
renders empty. Nothing about the response says the database was never reached;
only `wrangler tail` shows `getUpcomingForLanding failed: error code: 1003`.

This has happened. Recovery is `wrangler rollback <last-good-version-id>`.
Deploy through the workflow instead, which is the only place the production
`NEXT_PUBLIC_*` values exist.

## Local preview

`pnpm dev` remains the loop for iterating — it is Node, and it is fast. Use the
Worker preview to answer a narrower question: _does this run in an isolate?_

```bash
cp .dev.vars.example .dev.vars   # then fill it in
pnpm cf:preview                  # builds, then serves on workerd
```

Passing vitest does not answer that question, and neither does passing E2E.
Both run on Node — `playwright.config.ts` serves the app with `pnpm start` —
so neither can observe a restriction that only workerd applies. The image
resizer proved it: every upload route failed in production for weeks with all
four workflows green, because the WebAssembly it compiled per request is
disallowed on workerd and permitted everywhere the tests run.

Until something in CI exercises `workerd`, `pnpm cf:preview` is the only place
that answer exists. Run it before shipping anything that touches a runtime
boundary — sockets, WebAssembly, timers, streams.

## Scripts

| Script            | What it does                                            |
| ----------------- | ------------------------------------------------------- |
| `pnpm cf:build`   | Next build, adapted into `.open-next/`.                 |
| `pnpm cf:preview` | Build, then serve on the real runtime.                  |
| `pnpm cf:deploy`  | Build and upload. CI only — see "Deploying" above.      |
| `pnpm cf:typegen` | Regenerate `cloudflare-env.d.ts` from `wrangler.jsonc`. |

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

Uploads are resized by the browser and stored in Supabase Storage, so neither
step depends on the host at all. `resizeImage` keeps the `File → File` signature
the server-side resizer had, which is why moving the work across the network
touched one import per call site and nothing else.
