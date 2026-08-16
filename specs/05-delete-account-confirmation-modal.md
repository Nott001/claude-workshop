# 05 — Delete-account confirmation modal

## Purpose

Sheet 04 provided the state. This sheet builds the visible piece: a danger-zone
card in Account Settings with a "Delete my account" button that opens a modal
overlay asking the user to type `Delete My Account` before the destructive
request is enabled, exactly as the issue specifies. It also wires the section
into `account-settings.tsx`.

## Background (current code)

- Account Settings renders in `src/modules/user/components/account-settings.tsx`
  as one page with a single `<Form>` (`:29`) whose Save button lives at the
  foot (`:108-112`). The delete section must render **outside** that form — it
  is its own, separate, destructive action.
- The shared `Dialog` primitives exist at `src/shared/components/dialog.tsx`
  (`Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`,
  `DialogDescription`, `DialogFooter`), built on `@base-ui/react/dialog`.
- `Button` has a `danger` variant already (`src/shared/components/button.tsx:13`),
  and `Input` exists at `src/shared/components/input.tsx`.
- Surface conventions: the settings page uses `bg-surface`, `border-border`,
  `divide-y divide-border`, `text-fg` / `text-muted-fg` (see the enclosing
  card at `account-settings.tsx:30-33`).
- `useAccountSettings` already exposes a toast (`settings.toast`,
  `settings.notify`) rendered at `account-settings.tsx:116-126`. The delete
  hook's error is self-contained, so the section keeps its own inline error
  rather than borrowing the settings toast.

## Scope

A new component `src/modules/user/components/delete-account-section.tsx`
using the sheet-04 hook, plus a small edit to `account-settings.tsx`, plus
component tests. No changes to the hook, route or service.

## Steps

### 1. Create the section

New file `src/modules/user/components/delete-account-section.tsx`
(`"use client"`), consuming `useDeleteAccount()`:

**Danger card.**

```tsx
<div className="rounded-xl border border-border bg-surface">
  <div className="p-6">
    <h2 className="text-sm font-bold text-error">Delete Account</h2>
    <p className="mt-1 text-xs text-muted-fg">
      Deleting your account permanently removes your personal data. This cannot be undone.
    </p>
  </div>
  <div className="border-t border-border p-6">
    <DialogTrigger render={<Button variant="danger">Delete my account</Button>} />
  </div>
</div>
```

**Modal overlay** (inside the same `Dialog` root, mounted via
`DialogContent` which portals + overlays it, `dialog.tsx:28-58`).

- `DialogHeader` + `DialogTitle` "Delete my account".
- `DialogDescription` listing what is removed: support chat sessions and
  messages, tickets, Q&A messages, survey responses, email logs, password
  reset attempts, profile-photo uploads, and the speaker profile (if any).
  State plainly that **payments are kept but their buyer email is replaced
  with a deleted placeholder.**
- A labeled `Input` ("Type `Delete My Account` to confirm") bound to
  `phrase` / `setPhrase`.
- `DialogFooter` with `DialogClose render={<Button variant="secondary">Cancel
</Button>}` and a confirm `Button variant="danger"`:
  - `disabled={!canConfirm || submitting}`,
  - label `submitting ? "Deleting…" : "Delete Account"`,
  - `onClick={() => void confirm()}`.
- Inline error text under the input when `error` is set
  (`text-xs text-error`), cleared by the next keystroke (sheet 04 step 1).

### 2. Wire into Account Settings

In `src/modules/user/components/account-settings.tsx`: import
`DeleteAccountSection` and render it after the `</Form>` (i.e. below the Save
button block, `:112-113`), still inside the `max-w-[896px]` column and before
the toast block:

```tsx
<DeleteAccountSection />
```

It sits outside the `<Form>` so the modal is a sibling action and the Save
button never submits for it.

### 3. Component tests

New file `test/delete-account-section.test.tsx`, mocking the hook module
(after the pattern in `test/account-settings.test.tsx`) to drive the states
directly:

- the card renders a "Delete my account" button and the section summary;
- opening the dialog shows the removal list and the "payments are kept"
  notice, and an input labelled with the `Delete My Account` phrase;
- with the hook's `canConfirm` false, the confirm button is disabled;
  with it true, the button is enabled and label is "Delete Account";
- while `submitting`, the button shows "Deleting…" and is disabled;
- when `error` is set, the inline message renders.
  Keep the hook's own logic tested in sheet 04; this file only pins the bindings.

## Verify

```
pnpm format && pnpm lint && pnpm typecheck
pnpm test
```

Full suite green; coverage thresholds not lowered.

## Commit

```
feat(user): add delete-account confirmation modal

Body: the issue requires an explicit typed-phrase gate before a destructive
delete. The section keeps the confirm button disabled until the modal input
matches "Delete My Account", states exactly what is removed and that payments
stay anonymized, and renders outside the settings form so Save and Delete
never share a submit.
```

## Definition of done

- `DeleteAccountSection` renders a danger card, opens a modal, disables its
  confirm until the typed phrase matches, shows submitting/error states, and
  explains the payment-keeping behavior.
- It is rendered in `account-settings.tsx` outside the `<Form>`.
- `test/delete-account-section.test.tsx` covers the bindings; suite green.
