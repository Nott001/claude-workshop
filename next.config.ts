import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {/* config options here */};

export default nextConfig;

// Runs only under `next dev`, where it exposes the wrangler.jsonc bindings and
// .dev.vars to `getCloudflareContext()`. Without it the dev server and the
// deployed worker disagree about what exists in `env`, which is exactly the
// class of bug that only shows up in production.
initOpenNextCloudflareForDev();
