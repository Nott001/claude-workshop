# 05 — Changelog, gates and commit

## Goal

Document the change for users, run every gate CI enforces, and commit the whole effort on the branch from sheet 01.

## Why

The `CHANGELOG` already documents the inverse design ("the top bar's navigation links lose their boxes… they are text now"), so shipping this without an entry would leave the record describing the exact opposite of what is in the tree.

## Steps

### 1. `CHANGELOG.md`

Add a `Changed` bullet under `[Unreleased]` (in the `### Changed` list, alongside the other entries):

```md
- The navbar now says where you are with a line instead of a fill. The top bar's navigation links draw a brand underline flush with the bar's bottom edge on the current page and preview it at half strength on hover, while SIGN IN remains plain text. The staff rail trades its brand-tinted pill — a fill that had to be read against the rail's own background before you could tell two states apart — for a full-height brand line on the right edge of the active item, previewed the same way on hover, so an item under the cursor reads as an affordance and not a second filled bar. The heavier weight and `aria-current="page"` still say the current page outright, and no link in either bar keeps a background fill.
```

### 2. Gates

Run all four, in order, from the repo root:

```sh
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

Fix anything they flag. Do not lower the coverage thresholds in `vitest.config.ts` to get a pass.

### 3. Review the diff

```sh
git status
git diff
```

The diff should touch only:

- `src/modules/shell/components/top-navbar.tsx`
- `src/modules/shell/components/navbar.tsx`
- `test/top-navbar.test.tsx`
- `test/navbar-role-nav.test.tsx`
- `CHANGELOG.md`
- the five sheets under `specs/`

### 4. Commit

Stage the files above (not secrets, token, or lockfile churn) and commit everything in one go. The sequence is deliberately atomic and must not be split:

```sh
git add src/modules/shell/components/top-navbar.tsx \
        src/modules/shell/components/navbar.tsx \
        test/top-navbar.test.tsx \
        test/navbar-role-nav.test.tsx \
        CHANGELOG.md
git commit -m "feat: mark the current navbar entry with an underline and a rail line" -m "The top bar's active link and the staff rail's active item were told apart by brand colour alone - the bar against plain-text neighbours, the rail against a fill that had to be read against its own background. The current page is now a structural marker on both: an underline flush with the top bar's bottom edge, and a full-height line on the right edge of the rail item, each previewed at half strength on hover so the affordance and the current state are the same shape. The heavier weight and aria-current keep the state readable without relying on colour, and no nav link carries a background fill anymore."
```

Include the `specs/` sheets in a second, docs-only commit so the runnable sheets themselves are revisioned:

```sh
git add specs/
git commit -m "docs: add runnable spec sheets for the navbar indicator effort"
```

## Definition of done

- `CHANGELOG.md` carries the user-facing entry under `[Unreleased]`.
- `pnpm format`, `pnpm lint`, `pnpm typecheck` and `pnpm test` all pass.
- The working tree is clean after the two commits; branch `feat/navbar-selection-design` contains the whole effort.
