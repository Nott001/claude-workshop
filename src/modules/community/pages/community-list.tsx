"use client";

import { CommunityCard } from "@/modules/community/components/community-card";
import { useCommunityLinks } from "@/modules/community/lib/use-community-links";

export function CommunityListPage() {
  const { links, loading, error } = useCommunityLinks();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading community...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-sm text-destructive">Failed to load community groups.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-5">
      <div className="mb-3">
        <h1 className="text-base font-bold text-foreground">Community</h1>
        <p className="mt-1 text-sm text-muted-foreground">Join the conversation with fellow founders and builders.</p>
      </div>

      {links.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-sm text-muted-foreground">No community groups yet. Check back soon.</div>
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <CommunityCard
              key={link.id}
              label={link.label}
              description={link.description}
              iconUrl={link.icon_url}
              url={link.url}
            />
          ))}
        </div>
      )}
    </div>
  );
}
