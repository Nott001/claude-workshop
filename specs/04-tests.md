# 04 — Tests for the new selection indicators

## Goal

Update the two test files that pinned the old design so they assert the new behaviour — underline flush at the bar bottom / right-hand rail line, idle-lighter + hover-darker text, blue reserved for the selected entry, no fill anywhere — and add coverage for the rail's active state.

## Where

- `test/top-navbar.test.tsx`
- `test/navbar-role-nav.test.tsx`

## Why

`after:bg-brand` now trips the old "no `bg-`" regex in `top-navbar.test.tsx`, and the "no box" intent itself is obsolete. The rail file never asserted the active state at all — its `usePathname` is hard-wired to `/` — so the line could be deleted and the suite would still pass.

## Steps

### 1. `test/top-navbar.test.tsx`

Replace the outdated test "gives the nav links no box of its own" (currently lines 91-99):

```tsx
// The active item used to be a brand-tinted pill. Now that it is text on the
// bar's own background, colour is the only thing separating it from its
// neighbours — so it carries weight too, and says so out loud above.
it("distinguishes the active link by more than its colour", () => {
  renderAs(ROLES.ATTENDEE, "/events");

  expect(navLink("Events").className).toContain("font-semibold");
  expect(navLink("Home").className).toContain("font-medium");
});

it("gives the nav links no box of their own", () => {
  renderAs(ROLES.ATTENDEE, "/events");

  for (const label of ["Events", "Home"]) {
    const className = navLink(label).className;
    expect(className).not.toMatch(/(^|\s|:)bg-/);
    expect(className).not.toContain("border");
  }
});
```

with:

```tsx
// The active item used to be a brand-tinted pill, then bare brand text.
// It is an underline now, sitting flush at the bar's bottom edge. Hover
// lives only on non-selected links: idle text is lighter, and hovering
// darkens it — the selected entry carries no hover class and never changes.
it("distinguishes the active link by more than its colour", () => {
  renderAs(ROLES.ATTENDEE, "/events");

  expect(navLink("Events").className).toContain("font-semibold");
  expect(navLink("Home").className).toContain("font-medium");
});

it("marks the active link with a flush-bottom underline and no fill", () => {
  renderAs(ROLES.ATTENDEE, "/events");

  const active = navLink("Events").className;
  const idle = navLink("Home").className;

  expect(active).toContain("after:opacity-100");
  expect(active).toContain("after:bg-brand");
  expect(active).toContain("after:bottom-0");
  expect(active).toContain("text-brand");
  expect(active).not.toContain("hover:after"); // no line preview on hover
  expect(active).not.toContain("hover:text-fg"); // selected never darkens on hover
  expect(active).not.toContain("bg-brand/10");
  expect(active).not.toContain("bg-muted");

  expect(idle).not.toContain("after:opacity-100");
  expect(idle).toContain("after:opacity-0");
  expect(idle).toContain("text-muted-fg/80");
  expect(idle).toContain("hover:text-fg");
  expect(idle).not.toMatch(/(^|\s)bg-/);
});
```

(`"distinguishes the active link by more than its colour"` still passes — the weights are unchanged — but its comment is refreshed to stop it describing the pre-underline state.)

### 2. `test/navbar-role-nav.test.tsx`

a) Convert the hard-wired pathname mock to a settable one so an active state can be exercised. Change the top of the file:

```tsx
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));
```

to the same hoisted pattern the top-bar test uses:

```tsx
const { useSession, usePathname } = vi.hoisted(() => ({
  useSession: vi.fn(),
  usePathname: vi.fn(() => "/"),
}));
vi.mock("next/navigation", () => ({ usePathname }));
vi.mock("@/modules/auth/components/session-context", () => ({ useSession }));
```

b) Add a new suite after the existing ones:

```tsx
describe("Navbar selection state", () => {
  it("marks the current page with a right-hand line and no fill", () => {
    usePathname.mockReturnValue("/staff/community");
    renderAs(ROLES.ADMIN);

    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    const community = within(nav).getByRole("link", { name: /Community/ });
    const events = within(nav).getByRole("link", { name: /Events/ });

    expect(community.className).toContain("after:opacity-100");
    expect(community.className).toContain("after:bg-brand");
    expect(community.className).toContain("after:right-0");
    expect(community.className).toContain("text-brand");
    expect(community.className).not.toContain("hover:after");
    expect(community.className).not.toContain("hover:text-fg");
    expect(community.className).not.toContain("bg-brand/10");
    expect(community.className).not.toContain("bg-muted");

    expect(events.className).not.toContain("after:opacity-100");
    expect(events.className).toContain("after:opacity-0");
    expect(events.className).toContain("text-muted-fg/80");
    expect(events.className).toContain("hover:text-fg");
  });
});
```

### 3. `test/staff-navbar.test.tsx`

No change; it asserts only presence, not styling.

## Definition of done

- No test asserts the old fill/box design.
- Top-bar tests assert the flush-bottom underline, idle-lighter + hover-darker text, blue reserved for the selected entry, and the absence of a fill.
- Rail tests assert the right-hand line, idle-lighter + hover-darker text, blue reserved for the selected entry, no fill, and cover the active state for the first time.
- `pnpm test` is green.

## Verify

From the repo root, while `pnpm dev` is running:

```sh
pnpm test top-navbar navbar-role-nav staff-navbar
```

then the full suite once in sheet 05.
