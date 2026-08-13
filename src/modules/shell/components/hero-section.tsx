/**
 * The brand panel both landing heroes sit on. Only the chrome lives here — each
 * page owns its own heading, copy and call to action, because the two heroes
 * differ in what they say and where their data comes from, not in how they look.
 */
export function HeroSection({ children, media }: { children: React.ReactNode; media?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-b-[40px] bg-brand px-6 py-10 sm:px-12 lg:px-16 lg:py-8">
      <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="relative grid items-center gap-10 lg:min-h-[427px] lg:grid-cols-[1.1fr_.8fr] lg:gap-12">
        <div>{children}</div>
        {media}
      </div>
    </section>
  );
}

/**
 * The hero's media tile. `children` is overlay content — the attendee home page
 * puts its featured event here; the landing page shows the tile bare.
 */
export function HeroMediaCard({ children }: { children?: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[448px] overflow-hidden rounded-3xl border border-white/40 bg-white/40 p-1 shadow-2xl shadow-sky-950/20 backdrop-blur-sm">
      <div className="relative flex aspect-[1.85] items-end overflow-hidden rounded-[20px] bg-gradient-to-br from-[#153d64] via-[#1b7295] to-[#5dd3e7] p-6">
        <div className="absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(circle_at_40%_0%,rgba(255,255,255,.5),transparent_42%)]" />
        {children}
        {/* One glyph, not a disc plus an arrow: the design's badge is a 50px
            ring with the triangle at 45% of its diameter, which is play_circle
            at its natural proportions. */}
        <span
          aria-hidden
          // The size needs `!`: `.material-symbols-rounded` sets font-size: 20px
          // unlayered in globals.css, and unlayered rules outrank Tailwind's
          // layered utilities. Drop the `!` once that rule moves into @layer base.
          className="material-symbols-rounded absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[50px]! leading-none text-white drop-shadow-lg"
        >
          play_circle
        </span>
      </div>
    </div>
  );
}
