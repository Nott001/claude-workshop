/**
 * The frosted surface both app headers wear, minus the positioning they
 * disagree on — the attendee bar pins or scrolls depending on the screen, the
 * staff bar always pins.
 *
 * Shared rather than spelled out twice because the alpha and the blur are one
 * decision, not two: translucency is what lets the page read through, and the
 * blur is the only reason the links stay legible over whatever passes beneath
 * them. Half of that pair copied into a second bar is a bar you cannot read.
 */
export const NAV_BAR_SURFACE = "inset-x-0 top-0 z-20 border-b border-border bg-surface/75 backdrop-blur-xl";
