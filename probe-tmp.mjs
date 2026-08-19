import { chromium } from "@playwright/test";

const OBSERVE = () => {
  window.__cls = 0;
  window.__worst = 0;
  window.__shift = null;
  window.__lcp = 0;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__cls += e.value;
      if (e.value > window.__worst) {
        window.__worst = e.value;
        window.__shift = e.sources
          .map((s) => {
            const n = s.node;
            if (!n) return "?";
            const cls = typeof n.className === "string" ? "." + n.className.split(/\s+/).slice(0, 2).join(".") : "";
            return `${n.tagName?.toLowerCase()}${cls}`.slice(0, 46);
          })
          .join(" | ");
      }
    }
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__lcp = e.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
};

async function signIn(page, email) {
  await page.goto("http://localhost:3000/sign-in", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("dev-password-123");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 90000 });
}

const browser = await chromium.launch();
for (const [email, routes] of [
  ["attendee@example.com", ["/user", "/tickets", "/payments", "/courses", "/events"]],

  [
    "admin@example.com",
    [
      "/staff/events",
      "/staff/organization",
      "/staff/emails",
      "/staff/audit-logs",
      "/staff/community",
      "/staff/support",
      "/staff/profiler",
    ],
  ],
]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const login = await ctx.newPage();
  try {
    await signIn(login, email);
  } catch (e) {
    console.log(`!! sign-in failed for ${email}: ${String(e).slice(0, 80)}`);
    await ctx.close();
    continue;
  }
  await login.close();
  console.log(`\n== ${email} ==`);
  console.log("route                    CLS     LCP(ms)  worst shift source");
  for (const r of routes) {
    const page = await ctx.newPage();
    await page.addInitScript(OBSERVE);
    await page.goto("http://localhost:3000" + r, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    const m = await page.evaluate(() => ({ cls: window.__cls, lcp: Math.round(window.__lcp), src: window.__shift }));
    const flag = m.cls > 0.1 ? "  <== OVER BUDGET" : "";
    console.log(`${r.padEnd(24)} ${m.cls.toFixed(3).padStart(6)}  ${String(m.lcp).padStart(7)}  ${m.src ?? "-"}${flag}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
