"use client";

import { useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { useSpeakerEdit } from "@/modules/speakers/lib/use-speaker-edit";

export default function EditSpeakerProfilePage() {
  const params = useParams();
  const profileId = params.id as string;
  const {
    bio,
    setBio,
    photoUrl,
    setPhotoUrl,
    photoFile,
    setPhotoFile,
    designation,
    setDesignation,
    error,
    loading,
    uploading,
    handleFileChange,
    handleSubmit,
  } = useSpeakerEdit(profileId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (loading) return <div>Loading...</div>;
  if (error && !bio && !designation) return <div>{error}</div>;

  return (
    <>
      <div>
        <Link href="/speakers">&larr; Back to Speakers</Link>
        <h1>Edit Speaker Profile</h1>

        {error && <p>{error}</p>}

        <form onSubmit={handleSubmit}>
          <div>
            <label>Designation</label>
            <input value={designation} onChange={(e) => setDesignation(e.target.value)} />
          </div>
          <div>
            <label>Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div>
            <label>Photo</label>
            {photoUrl && !photoFile && (
              <div>
                <img src={photoUrl} alt="Current photo" style={{ maxWidth: "150px" }} />
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleFileChange} />
            {photoFile && <p>Selected: {photoFile.name}</p>}
            <input
              value={photoUrl}
              onChange={(e) => {
                setPhotoUrl(e.target.value);
                setPhotoFile(null);
              }}
              placeholder="Or paste image URL"
            />
          </div>
          <button type="submit" disabled={uploading}>
            {uploading ? "Uploading..." : "Update"}
          </button>
        </form>
      </div>
      <Footer role="speaker" />
    </>
  );
}
