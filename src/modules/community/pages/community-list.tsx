"use client";

import { useState } from "react";

import { CommunityCard } from "@/modules/community/components/community-card";
import { CommunityHero } from "@/modules/community/components/community-hero";
import { CommunityJoinDialog, type JoinTarget } from "@/modules/community/components/community-join-dialog";
import { EventMemoryCard } from "@/modules/community/components/event-memory-card";
import { useCommunityLinks } from "@/modules/community/lib/use-community-links";
import { useEventMemories } from "@/modules/events/lib/use-event-memories";

export function CommunityListPage() {
  const { links, loading, error } = useCommunityLinks();
  // Three finished events fills the grid's one row without a second.
  const { memories } = useEventMemories(3);
  const [joinTarget, setJoinTarget] = useState<JoinTarget | null>(null);

  return (
    <div className="flex flex-1 flex-col bg-bg text-fg">
      {/* The hero renders through every state: it owns no data, and holding it
          in place keeps the page from reflowing once the cards arrive. */}
      <CommunityHero />

      {/* The gap between sections has to clear the cards' own padding as well
          as the heading above it, or the next heading reads as part of the
          grid it follows rather than the one it introduces. */}
      {/* Left-aligned rather than centred: content starts at a fixed gutter and
          the grid takes the width it is given. `mr-auto` keeps that alignment
          once the cap bites — `mx-auto` would recentre the block and undo it.
          The cap stops a three-card row from stretching into unreadably wide
          cards on an ultrawide display. */}
      <div className="mr-auto w-full max-w-[1600px] space-y-20 px-5 py-14 sm:px-8 lg:px-12">
        <section>
          <h2 className="text-xl font-bold">Community Groups</h2>
          <p className="mt-1 text-sm text-muted-fg">
            Connect with other members and continue the conversation beyond the workshop.
          </p>

          <div className="mt-6">
            {loading ? (
              <p className="text-sm text-muted-fg">Loading community...</p>
            ) : error ? (
              <p className="text-sm text-error">Failed to load community groups.</p>
            ) : links.length === 0 ? (
              <p className="text-sm text-muted-fg">No community groups yet. Check back soon.</p>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {links.map((link) => (
                  <CommunityCard
                    key={link.id}
                    label={link.label}
                    description={link.description}
                    iconUrl={link.icon_url}
                    url={link.url}
                    onJoin={() => setJoinTarget({ label: link.label, url: link.url })}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Hidden entirely until there is an archive to show: an empty-state
            card here would advertise a section the app cannot fill yet. */}
        {memories.length > 0 && (
          <section>
            <h2 className="text-xl font-bold">Event Memories</h2>
            <p className="mt-1 text-sm text-muted-fg">Revisit the workshops and sessions this community has already run.</p>

            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {memories.map(({ event, photos, photoCount }) => (
                <EventMemoryCard key={event.event_id} event={event} photos={photos} photoCount={photoCount} />
              ))}
            </div>
          </section>
        )}
      </div>

      <CommunityJoinDialog target={joinTarget} onClose={() => setJoinTarget(null)} />
    </div>
  );
}
