import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No `incrementalCache` override on purpose. The adapter's default keeps the
// cache in the isolate's memory, which is correct while nothing is statically
// regenerated. The moment a route exports `revalidate`, this needs a real
// backing store (R2) and a `WORKER_SELF_REFERENCE` binding in wrangler.jsonc —
// see https://opennext.js.org/cloudflare/caching.
export default defineCloudflareConfig();
