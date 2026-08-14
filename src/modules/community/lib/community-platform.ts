/**
 * A community card stores a URL and nothing about where it leads, so the pill on
 * the card is read back off the hostname. Material Symbols ships no brand marks,
 * hence a semantic glyph per platform rather than a logo.
 */
export interface CommunityPlatform {
  name: string;
  icon: string;
}

const MESSENGER: CommunityPlatform = { name: "Messenger", icon: "chat" };
const WHATSAPP: CommunityPlatform = { name: "WhatsApp", icon: "chat" };
const TELEGRAM: CommunityPlatform = { name: "Telegram", icon: "send" };
const DISCORD: CommunityPlatform = { name: "Discord", icon: "forum" };
const FACEBOOK: CommunityPlatform = { name: "Facebook", icon: "public" };
const X: CommunityPlatform = { name: "X", icon: "public" };
const YOUTUBE: CommunityPlatform = { name: "YouTube", icon: "smart_display" };

/** Registrable domain → platform. Subdomains resolve through the same entry. */
const PLATFORMS_BY_HOST: Record<string, CommunityPlatform> = {
  "facebook.com": FACEBOOK,
  "fb.com": FACEBOOK,
  "m.me": MESSENGER,
  "messenger.com": MESSENGER,
  "whatsapp.com": WHATSAPP,
  "wa.me": WHATSAPP,
  "t.me": TELEGRAM,
  "telegram.me": TELEGRAM,
  "discord.com": DISCORD,
  "discord.gg": DISCORD,
  "slack.com": { name: "Slack", icon: "tag" },
  "linkedin.com": { name: "LinkedIn", icon: "work" },
  "instagram.com": { name: "Instagram", icon: "photo_camera" },
  "reddit.com": { name: "Reddit", icon: "forum" },
  "github.com": { name: "GitHub", icon: "code" },
  "youtube.com": YOUTUBE,
  "youtu.be": YOUTUBE,
  "x.com": X,
  "twitter.com": X,
};

/**
 * The platform a group link points at, or `null` when the URL will not parse.
 * An unrecognised host falls back to its own name: the pill stays true to the
 * link even where we have no label for it.
 */
export function platformFromUrl(url: string): CommunityPlatform | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }

  const host = hostname.replace(/^www\./, "");
  if (!host) return null;

  for (const [domain, platform] of Object.entries(PLATFORMS_BY_HOST)) {
    if (host === domain || host.endsWith(`.${domain}`)) return platform;
  }

  return { name: host, icon: "public" };
}
