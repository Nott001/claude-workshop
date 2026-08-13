# 01. Initialize and tune `supabase/config.toml`

## Goal

Create a committed `supabase/config.toml` that roots the local Supabase stack
(CLI + Docker): project identity, fixed ports, auth settings that mirror prod,
and local SMTP through inbucket.

## Run order

This is the first sheet. Nothing depends on it; everything after it does.

## Files touched

- `supabase/config.toml` (new)

## Prerequisites

- Docker daemon running (`docker info` succeeds).
- Supabase CLI installed (`supabase --version`, currently 2.109.1).
- No prior `supabase/` config exists in the repo (`supabase init` will generate one).

## Steps

1. From the repo root, run `supabase init`.
   - Do **not** use a VS Code extension flag; plain init.
   - This writes `supabase/config.toml` and a `.gitignore` covering
     `supabase/.temp/`.
2. Edit `supabase/config.toml`:
   - `project_id = "claude-workshop-local"`.
   - Pin ports explicitly (the generated file already does, verify them):
     - `[api] port = 54321`
     - `[db] port = 54322`
     - `[studio] port = 54323`
     - `[inbucket] port = 54324`
   - `[auth]` → `site_url = "http://localhost:3000"` and
     `additional_redirect_urls = ["http://127.0.0.1:3000"]`.
   - `[auth.email]` → `enable_confirmations = true` (mirrors prod).
   - `[auth.email.smtp]` → point at inbucket so confirmations/recovery mails are
     inspectable locally without a real mailbox:
     - `host = "127.0.0.1"`, `port = 54324`
     - `user = ""`, `pass = ""`
     - `admin_email = "admin@example.com"`, `sender_name = "Supabase Auth"`
   - Leave `[storage]`, `[realtime]`, `[analytics]` and edge-function blocks as
     generated unless a later sheet needs them.
3. Do not add storage bucket definitions here — buckets are seeded in
   sheet `09` (there is no `storage.buckets` block in config.toml).

## Verification

- `pnpm exec supabase start` boots without errors and `supabase status` reports
  the API on port 54321 and Studio on 54323.
- `pnpm exec supabase stop` stops it cleanly afterwards.
- `git status` shows exactly one new committed-worthy file: `supabase/config.toml`.

## Risks / notes

- First `supabase start` pulls several large images (~1–2 GB); allow time.
- If port 5432x is already in use locally, pick different ports and keep them
  consistent across every later sheet.
- The project_id string only affects the local stack; it is not the remote
  project ref (`aiyernsxamtgjebheekp`), which is wired in sheet `02`.
