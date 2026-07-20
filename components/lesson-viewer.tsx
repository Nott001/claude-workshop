"use client";

import { useState } from "react";

interface Lesson {
  lesson_id: number;
  description: string;
  content_type: string;
  content_url: string;
}

export default function LessonViewer({ lesson }: { lesson: Lesson }) {
  const [iframeError, setIframeError] = useState(false);

  const content = () => {
    switch (lesson.content_type) {
      case "pdf":
        return <iframe src={lesson.content_url} title={lesson.description} className="size-full" />;
      case "video":
        return <video controls src={lesson.content_url} className="max-h-full w-full" />;
      case "image":
        return <img src={lesson.content_url} alt={lesson.description} className="max-h-full w-full object-contain" />;
      case "link":
        if (iframeError) {
          return (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <span className="material-symbols-rounded text-3xl text-muted-foreground/50">link_off</span>
              <p className="text-sm text-muted-foreground">This page cannot be embedded.</p>
              <a
                href={lesson.content_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[#29B6F6] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#039be5]"
              >
                <span className="material-symbols-rounded text-sm">open_in_new</span>
                Open in new tab
              </a>
            </div>
          );
        }
        return (
          <iframe
            src={lesson.content_url}
            title={lesson.description}
            className="size-full"
            onError={() => setIframeError(true)}
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        );
      default:
        return <p className="text-sm text-muted-foreground">Unsupported content type: {lesson.content_type}</p>;
    }
  };

  return <div className="flex size-full items-center justify-center">{content()}</div>;
}
