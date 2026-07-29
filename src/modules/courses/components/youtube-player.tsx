"use client";

import { useEffect, useRef, useState } from "react";

let apiPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }

    window.onYouTubeIframeAPIReady = () => {
      window.onYouTubeIframeAPIReady = undefined;
      resolve();
    };

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(tag, first);
  });

  return apiPromise;
}

export function YouTubePlayer({ videoId }: { videoId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadYouTubeAPI().then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current) return;

    playerRef.current?.destroy();
    playerRef.current = new window.YT!.Player(containerRef.current, {
      videoId,
      width: "100%",
      height: "100%",
      playerVars: { autoplay: 0, rel: 0 },
    });

    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId, ready]);

  return <div ref={containerRef} className="size-full" />;
}

export function getYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (!host.includes("youtube.com") && !host.includes("youtu.be")) return null;
    if (host.includes("youtu.be")) return u.pathname.slice(1).split("/")[0] || null;
    if (u.pathname === "/watch") return u.searchParams.get("v");
    if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
  } catch {
    /* not a valid URL */
  }
  return null;
}
