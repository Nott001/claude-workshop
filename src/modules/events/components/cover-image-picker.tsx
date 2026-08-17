"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { describeRejection } from "@/shared/integrations/storage/policy";
import { CoverImageSection } from "@/modules/events/components/cover-image-section";

interface CoverImagePickerProps {
  /** Called with the file to upload once the event it belongs to exists. */
  onChange: (file: File | null) => void;
}

/**
 * The cover of an event that does not exist yet.
 *
 * It only stages the file: `buildEventImagePath` keys the object on the event
 * id, so there is nowhere to put the bytes until the row has been created — the
 * form uploads it afterwards. The file is still checked against the bucket
 * here, so a rejected image is reported while it can still be swapped, rather
 * than after an event has been created around it.
 *
 * Memoized because it sits in a form that re-renders on every keystroke and
 * nothing it shows depends on the fields being typed into.
 */
export const CoverImagePicker = memo(function CoverImagePicker({ onChange }: CoverImagePickerProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A blob URL outlives the component that made it, and a form being filled in
  // can go through several picks. Tracked in a ref so the last one can still be
  // released on unmount, where the state is already gone.
  const previewRef = useRef<string | null>(null);
  useEffect(() => () => void (previewRef.current && URL.revokeObjectURL(previewRef.current)), []);

  const handleFilePicked = useCallback(
    (picked: File) => {
      const rejection = describeRejection("event_images", picked);
      setError(rejection);
      // A rejected pick must not replace one that is already staged.
      if (rejection) return;

      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = URL.createObjectURL(picked);
      setPreviewUrl(previewRef.current);
      onChange(picked);
    },
    [onChange],
  );

  return <CoverImageSection previewUrl={previewUrl} error={error} onFilePicked={handleFilePicked} />;
});
