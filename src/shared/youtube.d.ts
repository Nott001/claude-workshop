/**
 * Minimal ambient types for the YouTube IFrame Player API, which is loaded at
 * runtime from https://www.youtube.com/iframe_api rather than bundled.
 *
 * Only the surface used by the app is declared — widen it as more of the API
 * gets used. See https://developers.google.com/youtube/iframe_api_reference.
 */
declare namespace YT {
  interface PlayerVars {
    autoplay?: 0 | 1;
    controls?: 0 | 1;
    rel?: 0 | 1;
    modestbranding?: 0 | 1;
    start?: number;
    [key: string]: unknown;
  }

  interface PlayerOptions {
    videoId?: string;
    width?: number | string;
    height?: number | string;
    playerVars?: PlayerVars;
    events?: {
      onReady?: (event: { target: Player }) => void;
      onStateChange?: (event: { target: Player; data: number }) => void;
      onError?: (event: { target: Player; data: number }) => void;
    };
  }

  class Player {
    constructor(element: HTMLElement | string, options?: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    loadVideoById(videoId: string): void;
    getCurrentTime(): number;
    getDuration(): number;
    getPlayerState(): number;
    destroy(): void;
  }
}

interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: (() => void) | undefined;
}
