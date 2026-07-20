"use client";

interface Lesson {
  lesson_id: number;
  description: string;
  content_type: string;
  content_url: string;
}

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);

    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      let videoId: string | null = null;

      if (u.hostname.includes("youtu.be")) {
        videoId = u.pathname.slice(1).split("/")[0] || null;
      } else if (u.pathname === "/watch") {
        videoId = u.searchParams.get("v");
      } else if (u.pathname.startsWith("/embed/")) {
        videoId = u.pathname.split("/")[2] || null;
      }

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
  } catch {
    /* not a valid URL */
  }
  return null;
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
      const embedUrl = getEmbedUrl(lesson.content_url) || `/api/proxy?url=${encodeURIComponent(lesson.content_url)}`;
      return (
        <div className="flex size-full flex-col">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <span className="material-symbols-rounded text-base text-muted-foreground">link</span>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{lesson.content_url}</span>
            <a
              href={lesson.content_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#29B6F6] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#039be5]"
            >
              <span className="material-symbols-rounded text-sm">open_in_new</span>
              Open
            </a>
          </div>
          <iframe
            src={embedUrl}
            title={lesson.description}
            className="mt-3 flex-1"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        </div>
      );
    }
    default:
      return <p className="text-sm text-muted-foreground">Unsupported content type: {lesson.content_type}</p>;
  }
}
