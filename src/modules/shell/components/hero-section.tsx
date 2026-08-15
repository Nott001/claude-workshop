/**
 * The brand panel both landing heroes sit on. Only the chrome lives here — each
 * page owns its own heading, copy and call to action, because the two heroes
 * differ in what they say and where their data comes from, not in how they look.
 *
 * There is no media slot. It used to carry a tile with a `play_circle` glyph
 * over a gradient, which promised a video that never existed: nothing rendered
 * a `<video>`, and on the landing page the tile was empty besides the glyph.
 * A single measured column reads as deliberate where a half-filled grid did not.
 */
export function HeroSection({ children }: { children: React.ReactNode }) {
  return (
    // `px-6` at every width, not the old px-6/sm:px-12/lg:px-16 ramp: the page
    // body below is flat px-6, and once the media tile stopped filling the
    // right half the two left edges no longer lined up on desktop.
    <section className="relative overflow-hidden rounded-b-hero bg-brand px-6 py-14 sm:py-16 lg:py-20">
      {/* Depth from two white/black washes rather than a second brand colour,
          so the panel still tracks `--brand` when the theme changes it. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(120%_100%_at_15%_0%,rgba(255,255,255,0.22),transparent_55%),linear-gradient(180deg,transparent_45%,rgba(2,32,56,0.22))]"
      />
      {/* The measure lives here, not on each page's heading and paragraph:
          one number to change, and the two heroes cannot drift apart. */}
      <div className="relative max-w-3xl">{children}</div>
    </section>
  );
}
