# 14 — Warn the old address when an email change is requested

## Purpose

The anti-takeover net for an email change is a message to the address actually on
the account: "someone requested to change your email — if this wasn't you, act
now." GoTrue already sends the `email_change` template to **both** the old and
the new address (`double_confirm_changes = true`, `config.toml:226`), but the
default copy tells the old-address recipient they can "safely ignore this email"
— which, in a real takeover attempt, reads as exactly the wrong reassurance. This
sheet replaces the default with a template that branches on which address it's
sent to: a confirm message for the new address, an unmistakable takeover warning
for the old one.

## Background (current code)

- `supabase/config.toml:252-255` shows the (commented) override shape:
  `[auth.email.template.invite]` with `subject` + `content_path`. The same keys
  exist for `email_change`; no template directory exists yet
  (`supabase/templates/` is absent).
- GoTrue mails one template for both legs of a change. From
  `internal/mailer/templatemailer`, `EmailChangeMail` renders
  `EmailChangeTemplate` once per address with `SendingTo` (the receiving address),
  `NewEmail` (the target), `ConfirmationURL`, `Token` and `SiteURL` in scope —
  data the default template ignores. Because both mails share one template, the
  branching has to happen inside it: `{{ if eq .SendingTo .NewEmail }}`.
- Both legs share the same `ConfirmationURL`-bearing link. With
  double-confirmations on, a confirmed change needs both addresses' clicks, so
  **both** messages must keep the confirm link; the old-address warning is
  additive to that link, not a replacement for it.
- Caveat to keep honest: GoTrue bug (supabase/auth #2600) silently downgrades
  double-confirm to single-click when `mailer_autoconfirm` is on. Our local stack
  uses `enable_confirmations = true`, so the two-token flow applies here — but do
  not write copy promising a hard "two clicks required" guarantee; the design
  depends on the config, not the copy.
- Mailpit (`http://127.0.0.1:54324`) is the local inbox; both legs of a change
  are inspectable there (sheet 12's gate already confirms two mails arrive).

## Scope

- New `supabase/templates/email_change.html`.
- New `[auth.email.template.email_change]` block in `supabase/config.toml`.
- No application code and no test changes — this is GoTrue-side copy.

## Steps

### 1. Template

Create `supabase/templates/email_change.html` (Go text/template):

- Branch on `{{ if eq .SendingTo .NewEmail }}`:
  - **New address:** "Confirm your new email address — {newEmail} will become the
    login email for your account once you confirm." with the link
    `{{ .ConfirmationURL }}`.
  - **Old address:** "Someone requested to change the email on this account to
    {newEmail}. If this was you, you can use the link below to allow it. If this
    was **not** you, someone else is trying to take over the account: do not
    click the link, change your password and contact us." with the same
    `{{ .ConfirmationURL }}` link.
- Keep the link visible in both branches; keep the copy calm and specific (per
  the security-notification norm: what changed, who to act, an undo path).
- Mind the double-confirm caveat: phrase the old-address ask as "allow it" not
  "this guarantees two confirmations are required".

### 2. Register in config

In `supabase/config.toml`, below the commented `[auth.email.template.invite]`
example (`:252`):

```toml
[auth.email.template.email_change]
subject = "Confirm your email change"
content_path = "./supabase/templates/email_change.html"
```

One subject serves both legs (GoTrue sends it verbatim to each address), so keep
it neutral rather than address-specific.

## Verify & commit

```sh
pnpm supabase restart   # or stop/start — auth must reload the template
pnpm test               # guaranteed untouched, run to prove nothing regressed
```

The restarted stack picks up `config.toml`; re-send a change in `pnpm dev` and
read Mailpit (`http://127.0.0.1:54324`): the old-address mail warns and still
carries a confirm link, the new-address mail confirms. Sheet 12's gate script can
be reused to drive the send + the two-mail check.

Commit (a config-only change; no thresholds move):

```
chore(settings): warn the old address when an email change is requested
```

Body: GoTrue already mails both addresses of a change (`double_confirm_changes`),
but the default template tells the old-address recipient to "safely ignore" — the
wrong reassurance in a takeover attempt. A custom `email_change` template branches
on `SendingTo`: the new address gets the confirm message, the old address gets an
unmistakable "if this wasn't you, someone is trying to take over this account"
warning, each still carrying its confirmation link so the double-confirm flow
keeps working.

## Definition of done

- A change request composes two distinct mails: a confirm message to the target
  address and a takeover warning to the address on the account.
- Both mails still carry a working confirmation link; nothing else in app or
  tests changed (full suite green).
- The double-confirm caveat (GoTrue #2600, autoconfirm) is not contradicted by
  the copy.
