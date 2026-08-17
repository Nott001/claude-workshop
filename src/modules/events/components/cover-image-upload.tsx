"use client";

import { useState } from "react";
import { postUpload } from "@/shared/integrations/storage/upload-client";
import { CoverImageSection } from "@/modules/events/components/cover-image-section";

interface CoverImageUploadProps {
  eventId: string;
  initialUrl: string | null;
  /** Lets the surrounding page reflect the new cover without a refetch. */
  onUploaded?: (url: string) => void;
}

/** The cover of an event that already exists, stored the moment it is picked. */
export function CoverImageUpload({ eventId, initialUrl, onUploaded }: CoverImageUploadProps) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFilePicked(file: File) {
    setError(null);
    setUploading(true);
    try {
      const result = await postUpload("event_images", "/api/upload/event-image", file, { event_id: eventId });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setUrl(result.url);
      onUploaded?.(result.url);
    } finally {
      setUploading(false);
    }
  }

  return <CoverImageSection previewUrl={url} busy={uploading} error={error} onFilePicked={handleFilePicked} />;
}
