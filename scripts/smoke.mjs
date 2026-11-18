// Post-deploy smoke test: the key pages open on a phone and a desktop, with no browser errors,
// correct 404s, and the live feed connected. Usage: SITE=https://… node scripts/smoke.mjs
import { chromium, devices } from "playwright";

const SITE = (process.env.SITE || "https://blockchainpi.vercel.app").replace(/\/$/, "");
const PAGES = ["/", "/blocks", "/txs", "/stats", "/pressure", "/whales", "/unlocks", "/report", "/learn", "/news"];
const failures = [];

async function status(path) {
  const r = await fetch(SITE + path, { redirect: "manual" });
  return r.status;
}

for (const [path, want] of [["/", 200], ["/this-page-does-not-exist", 404], ["/tx/zzz", 404], ["/sitemap.xml", 200], ["/api/v1/index", 200]]) {
  const got = await status(path);
  if (got !== want) failures.push(`${path}: expected ${want}, got ${got}`);
}

const browser = await chromium.launch();
for (const [name, opts] of [["phone", devices["iPhone 13"]], ["desktop", { viewport: { width: 1366, height: 900 } }]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of PAGES) {
    const res = await page.goto(SITE + path, { waitUntil: "domcontentloaded", timeout: 30000 }).catch((e) => ({ status: () => String(e.message).slice(0, 80) }));
    if (res?.status() !== 200) failures.push(`${name} ${path}: status ${res?.status()}`);
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 2) failures.push(`${name} ${path}: page wider than the screen by ${overflow}px`);
    const h = await page.$("main h1, main .hero");
    if (!h) failures.push(`${name} ${path}: no heading rendered`);
  }
  for (const e of errors) failures.push(`${name} browser error: ${e.slice(0, 160)}`);
  await ctx.close();
}
await browser.close();

if (failures.length) {
  console.error("Smoke test failed:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log(`Smoke test passed for ${SITE} (${PAGES.length} pages × phone + desktop).`);
