"use client";

import { memo, useMemo, useState } from "react";
import { AssignmentTable } from "@/modules/events/components/assignment-table";
import { SectionCard } from "@/shared/components/section-card";
import { useFacilitatorCandidates, useSpeakerCandidates } from "@/modules/events/lib/use-team-candidates";
import type { EventFieldSetter } from "@/modules/events/components/event-form-fields";

interface EventTeamFieldsProps {
  facilitatorIds: number[];
  speakerProfileIds: number[];
  set: EventFieldSetter;
}

/**
 * Staffing as part of the create form.
 *
 * Only creation works this way: there is no row to assign against until the
 * POST returns, so the ids ride along in the payload. An event that already
 * exists is staffed from `EventTeamPanel`, which PATCHes each change on its
 * own — the two used to be offered side by side, and an admin could not tell
 * which of them the roster on screen came from.
 *
 * It takes the two id arrays rather than the whole form, and is memoized on
 * them: two rosters of up to a hundred people each were being rebuilt on every
 * keystroke in the title field, which none of them depends on. `set` leaves the
 * arrays it does not touch alone, so their identity survives those keystrokes.
 */
export const EventTeamFields = memo(function EventTeamFields({ facilitatorIds, speakerProfileIds, set }: EventTeamFieldsProps) {
  const facilitators = useFacilitatorCandidates();
  const speakers = useSpeakerCandidates();
  const [selectedFacilitatorId, setSelectedFacilitatorId] = useState("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState("");

  // One pass over each roster instead of two, and only when the roster or the
  // assignment actually moves.
  const facilitatorLists = useMemo(() => split(facilitators.rows, facilitatorIds), [facilitators.rows, facilitatorIds]);
  const speakerLists = useMemo(() => split(speakers.rows, speakerProfileIds), [speakers.rows, speakerProfileIds]);

  function add(key: "facilitator_ids" | "speaker_profile_ids", ids: number[], raw: string, clear: (v: string) => void) {
    if (!raw) return;
    const id = Number(raw);
    if (!ids.includes(id)) set(key, [...ids, id]);
    clear("");
  }

  return (
    <SectionCard title="Team" icon="groups" description="Assigned when the event is created. Editable afterwards.">
      <div className="space-y-6">
        <div>
          <p className="mb-3 text-sm font-semibold text-fg">Facilitators</p>
          <AssignmentTable
            assigned={facilitatorLists.assigned}
            candidates={facilitatorLists.candidates}
            selectedId={selectedFacilitatorId}
            onSelect={setSelectedFacilitatorId}
            onAdd={() => add("facilitator_ids", facilitatorIds, selectedFacilitatorId, setSelectedFacilitatorId)}
            onRemove={(id) =>
              set(
                "facilitator_ids",
                facilitatorIds.filter((fid) => fid !== id),
              )
            }
            addButtonLabel="Assign"
            candidatePlaceholder="Select a facilitator..."
            emptyLabel={facilitators.error ? "Failed to load facilitators." : "No facilitators assigned yet."}
            allAssignedLabel="Every facilitator is assigned to this event."
          />
        </div>

        <div className="border-t border-border pt-5">
          <p className="mb-3 text-sm font-semibold text-fg">Speakers</p>
          <AssignmentTable
            assigned={speakerLists.assigned}
            candidates={speakerLists.candidates}
            selectedId={selectedSpeakerId}
            onSelect={setSelectedSpeakerId}
            onAdd={() => add("speaker_profile_ids", speakerProfileIds, selectedSpeakerId, setSelectedSpeakerId)}
            onRemove={(id) =>
              set(
                "speaker_profile_ids",
                speakerProfileIds.filter((sid) => sid !== id),
              )
            }
            addButtonLabel="Assign"
            candidatePlaceholder="Select a speaker..."
            emptyLabel={speakers.error ? "Failed to load speakers." : "No speakers assigned yet."}
            allAssignedLabel="Every speaker is assigned to this event."
          />
        </div>
      </div>
    </SectionCard>
  );
});

function split<T extends { id: number }>(rows: T[], assignedIds: number[]): { assigned: T[]; candidates: T[] } {
  const wanted = new Set(assignedIds);
  const assigned: T[] = [];
  const candidates: T[] = [];
  for (const row of rows) (wanted.has(row.id) ? assigned : candidates).push(row);
  return { assigned, candidates };
}
