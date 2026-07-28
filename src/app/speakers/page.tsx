"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/modules/auth";
import { useSpeakerProfiles } from "@/modules/speakers/lib/use-speaker-profiles";

export default function SpeakersPage() {
  const router = useRouter();
  const { loading: isLoaded, isSignedIn } = useSession();
  const {
    profiles,
    loading,
    error,
    showCreate,
    setShowCreate,
    userId,
    setUserId,
    bio,
    setBio,
    photoUrl,
    setPhotoUrl,
    designation,
    setDesignation,
    handleCreate,
    handleDelete,
  } = useSpeakerProfiles();

  if (loading) return <div>Loading speaker profiles...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <div>
        <h1>Speaker Profiles</h1>
        {isLoaded && isSignedIn && <button onClick={() => setShowCreate(true)}>Create Speaker Profile</button>}
      </div>

      {showCreate && (
        <form onSubmit={handleCreate}>
          <div>
            <label>User ID</label>
            <input type="number" value={userId} onChange={(e) => setUserId(e.target.value)} required />
          </div>
          <div>
            <label>Designation</label>
            <input value={designation} onChange={(e) => setDesignation(e.target.value)} />
          </div>
          <div>
            <label>Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div>
            <label>Photo URL</label>
            <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
          </div>
          <button type="submit">Save</button>
          <button type="button" onClick={() => setShowCreate(false)}>
            Cancel
          </button>
        </form>
      )}

      {profiles.length === 0 ? (
        <p>No speaker profiles yet.</p>
      ) : (
        <ul>
          {profiles.map((profile) => (
            <li key={profile.speaker_profile_id}>
              <div>
                <strong>{profile.USERS?.full_name ?? `User #${profile.user_id}`}</strong>
                {profile.designation && <span> - {profile.designation}</span>}
              </div>
              {profile.bio && <p>{profile.bio}</p>}
              <div>
                <button onClick={() => router.push(`/speakers/${profile.speaker_profile_id}/edit`)}>Edit</button>
                <button onClick={() => handleDelete(profile.speaker_profile_id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
