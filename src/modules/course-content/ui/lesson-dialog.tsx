"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormLabel } from "@/components/ui/form";

export function LessonDialog({
  open,
  onOpenChange,
  onAddLesson,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddLesson: (data: { description: string; file: File | null; url: string }) => Promise<string | null>;
}) {
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setDescription("");
    setFile(null);
    setUrl("");
    setError(null);
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    if (!file && !url.trim()) return;

    setUploading(true);
    setError(null);

    const err = await onAddLesson({ description: description.trim(), file, url: url.trim() });
    if (err) {
      setError(err);
      setUploading(false);
      return;
    }

    setUploading(false);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) reset();
        onOpenChange(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add lesson</DialogTitle>
        </DialogHeader>
        <Form onSubmit={handleSubmit}>
          <FormField>
            <FormLabel>Lesson name</FormLabel>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Introduction to the topic"
              required
            />
          </FormField>

          <FormField className="mt-3">
            <FormLabel>Upload file</FormLabel>
            <input
              type="file"
              accept="application/pdf,video/mp4,video/webm,video/quicktime,image/jpeg,image/png"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                if (e.target.files?.[0]) setUrl("");
              }}
              className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg file:mr-3 file:rounded-md file:border-0 file:bg-info/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-info hover:file:bg-blue-100"
            />
            {file && <p className="mt-1 text-xs text-muted-fg">Selected: {file.name}</p>}
          </FormField>

          <FormField className="mt-3">
            <FormLabel>Or paste a URL</FormLabel>
            <Input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (e.target.value) setFile(null);
              }}
              placeholder="https://..."
            />
          </FormField>

          {error && <p className="mt-2 text-xs text-error">{error}</p>}

          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={!description.trim() || uploading || (!file && !url.trim())}>
              {uploading ? (
                <>Uploading...</>
              ) : (
                <>
                  <span className="material-symbols-rounded text-[16px]">add_circle</span>
                  Add lesson
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
