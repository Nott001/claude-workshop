import { formatEventDate } from "@/shared/lib/date-utils";
import { withBackLink } from "@/shared/lib/back-link";
import { cn } from "@/shared/lib/utils";
import { CardCta } from "@/shared/components/card-cta";
import { CardLink } from "@/shared/components/card-link";
import type { EventPhoto, LandingEvent } from "@/shared/types";

/** Beyond four the mosaic stops reading as a card and starts reading as the
 *  gallery it links to. Matches what the API sends per event. */
const MAX_TILES = 4;

interface EventMemoryCardProps {
  event: LandingEvent;
  /** The head of the event's archive. Empty for an event nobody photographed. */
  photos: EventPhoto[];
  /** The whole archive's size, which is what the card's link offers. */
  photoCount: number;
}

/**
 * One finished event in the memories strip.
 *
 * The card used to be text-only, and said so: there was a single cover image per
 * event and no gallery behind it, so a photo would have promised more than the
 * archive could show. There is an archive now, and the card leads with it —
 * without one it degrades to exactly the summary it used to be, which is what
 * keeps an unphotographed session on the strip rather than quietly dropping it.
 */
export function EventMemoryCard({ event, photos, photoCount }: EventMemoryCardProps) {
  const tiles = photos.slice(0, MAX_TILES);

  return (
    <CardLink
      // Always the archive, whether or not there is anything in it yet. Landing
      // on the event's own page is what made a memory a link to a registration
      // form for a session that already happened, and an empty archive is still
      // an archive — the page it opens says so, which is a better answer than
      // silently sending the reader somewhere else.
      href={withBackLink(`/events/${event.event_id}/memories`, "community")}
      // A column, so the body can push its call to action to the bottom and a
      // card with a one-word course name lines up with one that wraps.
      className="flex h-full flex-col"
    >
      {tiles.length > 0 ? <PhotoMosaic tiles={tiles} /> : <EmptyMosaic />}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-fg">
          <span>{formatEventDate(event.event_date)}</span>
          {event.course_name && (
            <>
              <span aria-hidden>&middot;</span>
              <span className="truncate">{event.course_name}</span>
            </>
          )}
        </div>

        {/* No venue. A memory is looked at, not travelled to — the address is
            live-event information, and the event's own page still carries it
            for anyone who wants it. */}
        <h3 className="mt-2 text-base font-bold tracking-[-0.01em] text-fg">{event.title}</h3>

        <CardCta className="mt-auto pt-4">
          {photoCount > 0 ? `View ${photoCount} ${photoCount === 1 ? "photo" : "photos"}` : "View memories"}
        </CardCta>
      </div>
    </CardLink>
  );
}

/**
 * The same block the mosaic occupies, for an event whose archive is still
 * empty.
 *
 * Not omitted. A card with no picture area is the text-only card this strip
 * used to be — it stops reading as a memory, and beside two cards that do have
 * photographs it makes the row ragged. Holding the space says the archive is
 * the point and this one has yet to be filled, which is also what the page it
 * opens now says.
 */
function EmptyMosaic() {
  return (
    <div className="grid aspect-[1.85] w-full place-items-center border-b border-border bg-muted text-center">
      <div>
        <span aria-hidden className="material-symbols-rounded text-3xl text-muted-fg">
          photo_library
        </span>
        <p className="mt-1 text-xs font-medium text-muted-fg">No photos yet</p>
      </div>
    </div>
  );
}

/**
 * One tall tile beside a column of the rest, so a card with four photos and a
 * card with two are the same height and the strip stays a grid. A single photo
 * takes the full width rather than sitting in a half-empty mosaic.
 */
function PhotoMosaic({ tiles }: { tiles: EventPhoto[] }) {
  const [lead, ...rest] = tiles;

  return (
    // The hairline gaps are the parent's background showing through, so the
    // mosaic needs no borders between tiles that would double up at the edges.
    <div className="flex aspect-[1.85] w-full gap-0.5 bg-border">
      <Tile photo={lead} className={rest.length === 0 ? "flex-1" : "flex-2"} />
      {rest.length > 0 && (
        // `flex-1` on each rather than a row count in a style attribute: the
        // column divides itself however many photos land in it, and Tailwind
        // cannot generate a class from a number known only at runtime.
        <div className="flex flex-1 flex-col gap-0.5">
          {rest.map((photo) => (
            <Tile key={photo.id} photo={photo} className="flex-1" />
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({ photo, className }: { photo: EventPhoto; className?: string }) {
  return (
    /* Served through /api/storage, which next/image cannot fetch without a custom loader. */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.image_url}
      // Decorative: the card's heading already names the event, and a caption
      // read out per tile turns one link into four announcements.
      alt=""
      loading="lazy"
      className={cn(
        "h-full w-full min-h-0 bg-muted object-cover transition-transform duration-300 ease-in-out motion-safe:group-hover:scale-105",
        className,
      )}
    />
  );
}
