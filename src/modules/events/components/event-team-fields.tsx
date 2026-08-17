"use client";

import { useState } from "react";
import { AssignmentTable } from "@/modules/events/components/assignment-table";
import { SectionCard } from "@/shared/components/section-card";
import { useFacilitatorCandidates, useSpeakerCandidates } from "@/modules/events/lib/use-team-candidates";
import type { EventFieldSetter } from "@/modules/events/components/event-form-fields";
import type { EventFormValues } from "@/modules/events/lib/event-form-schema";

/**
 * Staffing as part of the create form.
 *
 * Only creation works this way: there is no row to assign against until the
 * POST returns, so the ids ride along in the payload. An event that already
 * exists is staffed from `EventTeamPanel`, which PATCHes each change on its
 * own — the two used to be offered side by side, and an admin could not tell
 * which of them the roster on screen came from.
 */
export function EventTeamFields({ values, set }: { values: EventFormValues; set: EventFieldSetter }) {
  const facilitators = useFacilitatorCandidates();
  const speakers = useSpeakerCandidates();
  const [selectedFacilitatorId, setSelectedFacilitatorId] = useState("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState("");

  function add(key: "facilitator_ids" | "speaker_profile_ids", raw: string, clear: (v: string) => void) {
    if (!raw) return;
    const id = Number(raw);
    if (!values[key].includes(id)) set(key, [...values[key], id]);
    clear("");
  }

  return (
    <SectionCard title="Team" icon="groups" description="Assigned when the event is created. Editable afterwards.">
      <div className="space-y-6">
        <div>
          <p className="mb-3 text-sm font-semibold text-fg">Facilitators</p>
          <AssignmentTable
            assigned={facilitators.rows.filter((c) => values.facilitator_ids.includes(c.id))}
            candidates={facilitators.rows.filter((c) => !values.facilitator_ids.includes(c.id))}
            selectedId={selectedFacilitatorId}
            onSelect={setSelectedFacilitatorId}
            onAdd={() => add("facilitator_ids", selectedFacilitatorId, setSelectedFacilitatorId)}
            onRemove={(id) =>
              set(
                "facilitator_ids",
                values.facilitator_ids.filter((fid) => fid !== id),
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
            assigned={speakers.rows.filter((c) => values.speaker_profile_ids.includes(c.id))}
            candidates={speakers.rows.filter((c) => !values.speaker_profile_ids.includes(c.id))}
            selectedId={selectedSpeakerId}
            onSelect={setSelectedSpeakerId}
            onAdd={() => add("speaker_profile_ids", selectedSpeakerId, setSelectedSpeakerId)}
            onRemove={(id) =>
              set(
                "speaker_profile_ids",
                values.speaker_profile_ids.filter((sid) => sid !== id),
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
}
