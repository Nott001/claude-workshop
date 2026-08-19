"use client";

import { useState } from "react";
import { apiErrorMessage } from "@/shared/lib/api-error-message";
import { AssignmentTable, type AssignmentRow } from "@/modules/events/components/assignment-table";
import { SectionCard } from "@/shared/components/section-card";
import { useEventSpeakers } from "@/modules/events/lib/use-event-speakers";
import { useFacilitatorCandidates } from "@/modules/events/lib/use-team-candidates";

function FacilitatorAssignments({ eventId, initialIds }: { eventId: string; initialIds: number[] }) {
  const { rows: candidates, error: loadError } = useFacilitatorCandidates();
  const [ids, setIds] = useState<number[]>(initialIds);
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sync(next: number[]): Promise<boolean> {
    if (saving) return false;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilitator_ids: next }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(apiErrorMessage(body, "Failed to update facilitators"));
      setSaving(false);
      return false;
    }
    setIds(next);
    setSaving(false);
    return true;
  }

  async function handleAdd() {
    if (!selectedId) return;
    const id = Number(selectedId);
    if (ids.includes(id)) return;
    if (await sync([...ids, id])) setSelectedId("");
  }

  async function handleRemove(id: number) {
    if (!confirm("Remove this facilitator from the event?")) return;
    await sync(ids.filter((fid) => fid !== id));
  }

  const known = candidates.filter((c) => ids.includes(c.id));
  // A facilitator who was re-roled after assignment still appears, just unnamed.
  const unknown: AssignmentRow[] = ids
    .filter((id) => !candidates.some((c) => c.id === id))
    .map((id) => ({ id, name: `User #${id}` }));

  return (
    <>
      {error && <p className="mb-3 text-xs text-error">{error}</p>}
      <AssignmentTable
        assigned={[...known, ...unknown]}
        candidates={candidates.filter((c) => !ids.includes(c.id))}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={handleAdd}
        onRemove={handleRemove}
        addButtonLabel={saving ? "Saving..." : "Assign"}
        candidatePlaceholder="Select a facilitator..."
        emptyLabel={loadError ? "Failed to load facilitators." : "No facilitators assigned to this event."}
        allAssignedLabel="Every facilitator is assigned to this event."
      />
    </>
  );
}

function SpeakerAssignments({ eventId }: { eventId: string }) {
  const {
    assignments,
    allProfiles,
    loading,
    error,
    selectedProfileId,
    setSelectedProfileId,
    availableProfiles,
    profilesLoadingMore,
    profilesHasMore,
    loadMoreProfiles,
    handleAssign,
    handleRemove,
  } = useEventSpeakers(eventId);

  const assigned: AssignmentRow[] = assignments.map((a) => {
    const profile = allProfiles.find((p) => p.id === a.speaker_profile_id);
    return {
      id: a.speaker_profile_id,
      name: a.SPEAKER_PROFILE?.USER?.full_name ?? profile?.USER?.full_name ?? `Speaker #${a.speaker_profile_id}`,
      detail: a.SPEAKER_PROFILE?.designation ?? profile?.USER?.email ?? undefined,
    };
  });

  return (
    <>
      {error && <p className="mb-3 text-xs text-error">{error}</p>}
      <AssignmentTable
        loading={loading}
        assigned={assigned}
        candidates={availableProfiles.map((p) => ({
          id: p.id,
          name: p.USER?.full_name ?? `Speaker #${p.id}`,
          detail: p.designation ?? p.USER?.email ?? undefined,
        }))}
        selectedId={selectedProfileId}
        onSelect={setSelectedProfileId}
        onAdd={handleAssign}
        onRemove={handleRemove}
        addButtonLabel="Assign"
        candidatePlaceholder="Select a speaker..."
        emptyLabel="No speakers assigned to this event."
        allAssignedLabel="Every speaker is assigned to this event."
        candidatesLoadingMore={profilesLoadingMore}
        candidatesHasMore={profilesHasMore}
        onLoadMoreCandidates={loadMoreProfiles}
      />
    </>
  );
}

/**
 * Who staffs an existing event. Every add and remove is its own request, so the
 * roster is never waiting on an unrelated field elsewhere in a form to validate.
 *
 * Both rosters load from here rather than from the page, so a facilitator — who
 * cannot see this tab at all — no longer pays for the speaker fetch on arrival.
 */
export function EventTeamPanel({ eventId, facilitatorIds }: { eventId: string; facilitatorIds: number[] }) {
  return (
    <div className="space-y-6">
      <SectionCard title="Facilitators" icon="groups" description="Staff who run this event and can open its check-in kiosk.">
        <FacilitatorAssignments eventId={eventId} initialIds={facilitatorIds} />
      </SectionCard>

      <SectionCard title="Speakers" icon="record_voice_over" description="Speakers billed on the event and its course.">
        <SpeakerAssignments eventId={eventId} />
      </SectionCard>
    </div>
  );
}
