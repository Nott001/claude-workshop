"use client";

import { useRouter, useParams } from "next/navigation";
import { Footer } from "@/components/footer";
import { useEventSpeakers } from "@/modules/event-management/lib/use-event-speakers";

export default function EventSpeakersPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const {
    assignments,
    loading,
    error,
    selectedProfileId,
    setSelectedProfileId,
    availableProfiles,
    handleAssign,
    handleRemove,
  } = useEventSpeakers(eventId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <>
      <div>
        <button onClick={() => router.push(`/events/${eventId}`)}>&larr; Back to Event</button>
        <h1>Manage Speakers</h1>

        <h2>Assigned Speakers</h2>
        {assignments.length === 0 ? (
          <p>No speakers assigned yet.</p>
        ) : (
          <ul>
            {assignments.map((a) => (
              <li key={a.speaker_profile_id}>
                {a.SPEAKER_PROFILES ? (
                  <>
                    <span>Profile #{a.speaker_profile_id}</span>
                    {a.SPEAKER_PROFILES.designation && <span> - {a.SPEAKER_PROFILES.designation}</span>}
                    {a.SPEAKER_PROFILES.bio && <p>{a.SPEAKER_PROFILES.bio}</p>}
                  </>
                ) : (
                  <span>Profile #{a.speaker_profile_id}</span>
                )}
                <button onClick={() => handleRemove(a.speaker_profile_id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}

        <hr />

        <h2>Assign Speaker</h2>
        {availableProfiles.length === 0 ? (
          <p>No available speakers to assign.</p>
        ) : (
          <form onSubmit={handleAssign}>
            <div>
              <label>Speaker Profile</label>
              <select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)} required>
                <option value="">Select a speaker...</option>
                {availableProfiles.map((p) => (
                  <option key={p.speaker_profile_id} value={p.speaker_profile_id}>
                    {p.USERS?.full_name ?? `User #${p.user_id}`}
                    {p.designation ? ` (${p.designation})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit">Assign</button>
          </form>
        )}
      </div>
      <Footer role="facilitator" />
    </>
  );
}
