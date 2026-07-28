"use client";

import { YouTubePlayer, getYouTubeVideoId } from "@/modules/courses/components/youtube-player";

interface Lesson {
  lesson_id: number;
  description: string;
  content_type: string;
  content_url: string;
}

export default function LessonViewer({ lesson }: { lesson: Lesson }) {
  switch (lesson.content_type) {
    case "pdf":
      return <iframe src={lesson.content_url} title={lesson.description} className="size-full" />;
    case "video":
      return <video controls src={lesson.content_url} className="max-h-full w-full" />;
    case "image":
      return <img src={lesson.content_url} alt={lesson.description} className="max-h-full w-full object-contain" />;
    case "link": {
      const videoId = getYouTubeVideoId(lesson.content_url);
      if (videoId) {
        return <YouTubePlayer videoId={videoId} />;
      }
      return (
        <div className="flex size-full items-center justify-center">
          <div className="flex w-full max-w-lg flex-col items-center gap-4 text-center">
            <span className="material-symbols-rounded text-4xl text-muted-foreground/50">link</span>
            <span className="max-w-full truncate text-sm text-muted-foreground">{lesson.content_url}</span>
            <a
              href={lesson.content_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand/80"
            >
              <span className="material-symbols-rounded text-sm">open_in_new</span>
              Open link
            </a>
          </div>
        </div>
      );
    }
    default:
      return <p className="text-sm text-muted-foreground">Unsupported content type: {lesson.content_type}</p>;
  }
}
