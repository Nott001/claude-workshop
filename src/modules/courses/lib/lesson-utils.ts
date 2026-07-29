export function detectContentType(file: File | null, url: string): string {
  void url;
  if (file) {
    if (file.type.startsWith("video/")) return "video";
    if (file.type === "application/pdf") return "pdf";
    return "image";
  }
  return "link";
}

export function normalizeUrl(url: string): string {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return `https://${url}`;
  }
  return url;
}

export function getUploadEndpoint(contentType: string): string | undefined {
  if (contentType === "video") return "/api/upload/course-video";
  if (contentType === "pdf") return "/api/upload/course-asset";
  return undefined;
}
