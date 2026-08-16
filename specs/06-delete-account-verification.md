# 06 — Account deletion end-to-end verification

## Purpose

Sheets 01–05 built the feature. This sheet closes it: a no-holds-barred
verification of the whole flow against the live local stack, a manual gate for
the data-retention behavior that unit tests cannot prove (payments keep a
tombstone whose email reads as deleted), and the changelog entry.

## What the finished feature is

A user in Account Settings clicks "Delete my account", types `Delete My
Account` into the modal, and the account is torn down:

| Removed                                                                      | Kept                                                                                                                        |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Support chat sessions (ended via `endCase`) and chat messages                | `USER` row, anonymized — `email` → `deleted-<id>@deleted.local`, `full_name` → `Deleted User`, `profile_image_url` → `NULL` |
| Tickets, Q&A messages, survey responses, email logs, password-reset attempts | `PAYMENT` rows — link to the tombstone, so their buyer email renders as the deleted placeholder                             |
| `profile_images/users/<id>/` uploads                                         | —                                                                                                                           |
| `SPEAKER_PROFILE` (cascades `EVENT_SPEAKER`)                                 | —                                                                                                                           |
| The Supabase auth identity (`auth.admin.deleteUser`)                         | —                                                                                                                           |

## Steps

### 1. Gates

Run the full suite exactly as CI does, then the focused feature tests:

```
pnpm format && pnpm lint && pnpm typecheck && pnpm test
```

Coverage thresholds (a ratchet per AGENTS.md) must not be lowered. The
migration-grants test list stays at six files — no migration was added — so
its exact-chain assertion must pass unchanged.

### 2. Manual gate against the live stack

These behaviors cannot be proven by the unit layer, so verify them in the
browser with `pnpm dev`:

1. Log in as a seeded account that has: an open support case, a ticket, a QA
   message, a survey response row, an email log, a profile photo, and — to
   cover the speaker branch — a speaker profile.
2. Navigate to Account Settings, click **Delete my account**. Confirm the
   modal keeps the button disabled until `Delete My Account` is typed exactly
   (whitespace around it fine, any other text not).
3. Confirm. The browser signs out and lands on `/`.
4. Inspect the database (`pnpm supabase status` / a DB client):
   - no `CHAT_MESSAGE` rows reference the user (sender or recipient),
   - no `TICKET`, `QA_MESSAGE`, `SURVEY_RESPONSE`, `EMAIL_LOG` row has the
     user id, no `PASSWORD_RESET_ATTEMPT` row has the old email,
   - no `SPEAKER_PROFILE` row has the user id,
   - `profile_images` has no `users/<id>/` folder,
   - the `USER` row still exists with `full_name = 'Deleted User'`,
     `email = 'deleted-<id>@deleted.local'`, `profile_image_url = NULL`,
   - each `PAYMENT` row still has `user_id` pointing at the tombstone, so a
     staff payment view resolves the buyer email to `deleted-<id>@deleted.local`
     instead of the address.
5. Sign back up with the same email: a fresh account is provisioned (`ensureUser`
   keys on the new auth UUID) and works normally; the old tombstone is untouched.
6. Re-run the sign-in attempt with the original credentials through the forgot
   password/recover flow: the old account name must not resolve.

### 3. CHANGELOG

Append a user-facing entry (AGENTS.md: update `CHANGELOG.md` for meaningful,
user-visible commits):

```
## Unreleased

### Added
- Account Settings now offers **Delete account**: the confirmation modal
  requires typing "Delete My Account", then removes the user's chat sessions
  and messages, tickets, Q&A posts, surveys, email logs, password-reset
  attempts, uploads and speaker profile, and deletes the sign-in identity.
  Payment history is kept but its buyer email is replaced with a "deleted"
  placeholder.
```

## Commit

```
docs(changelog): note account deletion in Account Settings

Body: account deletion is user-facing and must be discoverable in the
changelog; payment rows are retained with an anonymized buyer email, which
readers will care about.
```

## Definition of done

- Full suite green with thresholds unchanged.
- The manual gate confirms every removal column of the table above, the kept
  tombstone + payment placeholder, and that re-registration works.
- `CHANGELOG.md` carries an `Added` entry for account deletion.
