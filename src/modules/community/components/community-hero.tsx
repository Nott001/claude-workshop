/**
 * The community hero. The photograph is a local asset rather than a hotlink:
 * the deployed target is a Cloudflare Worker serving `public/` as static
 * assets, so a remote host would be one more thing that can fail the page.
 * Swap `public/community-hero.webp` to change it.
 *
 * One file, 1200w, no srcset. A responsive set was measured and dropped: the
 * photo is decoration under a 65–95% opaque scrim, so a single 1200w reads the
 * same on a 4K display as a 1600w does, and costs less than the 1600w alone did
 * — which left the second file serving only DPR-1 phones, for a saving smaller
 * than the risk of the two images drifting apart.
 *
 * The gradient underneath is not decoration — it is what the visitor sees while
 * the photo is still in flight, and if the file ever goes missing the heading
 * stays legible instead of landing white-on-white.
 *
 * The prototype carries member/event/project count pills here. They are left
 * out until something real backs them: only the event count is countable today,
 * and member totals are deliberately withheld from anonymous visitors — the
 * same reason listEvents keeps attendee counts to staff.
 */
export function CommunityHero() {
  // Taller than the prototype's own py-16/py-20 on purpose: that hero also
  // carried a row of count pills, and matching its padding alone would leave
  // this one a good 60px shorter than the design it is copying.
  return (
    <section className="relative overflow-hidden px-4 py-20 text-center sm:px-6 sm:py-28">
      <div className="absolute inset-0 bg-gradient-to-br from-sky-700 via-cyan-600 to-teal-500" />
      <img
        src="/community-hero.webp"
        alt=""
        aria-hidden
        // Above the fold and the largest thing on screen: this is the LCP
        // element, so it must not sit behind the lazy-loading queue.
        loading="eager"
        fetchPriority="high"
        className="absolute inset-0 size-full object-cover"
      />
      {/* The prototype's scrim is bottom-heavy because its count pills sit in
          the dark foot. Without them the copy rides higher, over the crowd and
          the lit wall behind it, so the top end is held at 65% rather than the
          prototype's 30% — white text has to clear the brightest pixel it can
          land on, not the average one. */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/75 to-slate-900/65" />

      <div className="relative mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Connect, Share &amp; Learn Together</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">
          Join the StartupLab community, connect with fellow workshop participants, and keep the conversation going long after
          the session ends.
        </p>
      </div>
    </section>
  );
}
