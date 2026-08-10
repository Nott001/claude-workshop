"use client";

import { useRouter, useParams } from "next/navigation";
import { useEventSpeakers } from "@/modules/events/lib/use-event-speakers";
import { LoadMoreButton } from "@/shared/components/load-more";

export default function StaffEventSpeakersPage() {
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
    profilesLoadingMore,
    profilesHasMore,
    loadMoreProfiles,
    handleAssign,
    handleRemove,
  } = useEventSpeakers(eventId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <>
      <div>
        <button onClick={() => router.push(`/staff/events/${eventId}`)}>&larr; Back to Event</button>
        <h1>Manage Speakers</h1>

        <h2>Assigned Speakers</h2>
        {assignments.length === 0 ? (
          <p>No speakers assigned yet.</p>
        ) : (
          <ul>
            {assignments.map((a) => (
              <li key={a.speaker_profile_id}>
                {a.SPEAKER_PROFILE ? (
                  <>
                    <span>Profile #{a.speaker_profile_id}</span>
                    {a.SPEAKER_PROFILE.designation && <span> - {a.SPEAKER_PROFILE.designation}</span>}
                    {a.SPEAKER_PROFILE.bio && <p>{a.SPEAKER_PROFILE.bio}</p>}
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
                  <option key={p.id} value={p.id}>
                    {p.USER?.full_name ?? `User #${p.user_id}`}
                    {p.designation ? ` (${p.designation})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit">Assign</button>
          </form>
        )}
        {profilesHasMore && (
          <LoadMoreButton loading={profilesLoadingMore} onLoadMore={loadMoreProfiles} label="Load more speakers" />
        )}
      </div>
    </>
  );
}
