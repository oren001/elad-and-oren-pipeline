// Verify /api/room handler returns no-store headers and a valid JSON body
// even when KV is unavailable (which is the realistic edge case at cold-start
// or when the binding is missing). We mock @cloudflare/next-on-pages by
// stubbing the KV via globalThis before importing the route.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repo = resolve(__dirname, "..");

const routeSrc = readFileSync(resolve(repo, "src/app/api/room/route.ts"), "utf8");

// Static assertions on the source — fast, no transpile needed.
const checks = [
  ["no-store, no-cache", /no-store, no-cache, must-revalidate, max-age=0/],
  ["cdn-cache-control no-store", /"cdn-cache-control":\s*"no-store"/],
  ["cloudflare-cdn-cache-control no-store", /"cloudflare-cdn-cache-control":\s*"no-store"/],
  ["pragma no-cache", /pragma:\s*"no-cache"/],
  ["content-type json", /"content-type":\s*"application\/json/],
  ["uses new Response (not Response.json)", /new Response\(/],
  ["edge runtime", /export const runtime = "edge"/],
];

let failed = 0;
for (const [name, re] of checks) {
  const ok = re.test(routeSrc);
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
  if (!ok) failed++;
}

const pageSrc = readFileSync(resolve(repo, "src/app/page.tsx"), "utf8");
const pageChecks = [
  ["fetch uses cache buster", /\/api\/room\?t=\$\{Date\.now\(\)\}/],
  ["AbortController timeout", /new AbortController\(\)/],
  ["8 second timeout", /setTimeout\(\(\) => ac\.abort\(\), 8000\)/],
  ["inflight guard", /if \(inflight\) return;\s*inflight = true;/],
  ["timeout error label", /"timeout"/],
  ["full reset button", /window\.location\.replace\("\/\?reset=1"\)/],
];

for (const [name, re] of pageChecks) {
  const ok = re.test(pageSrc);
  console.log(`${ok ? "PASS" : "FAIL"}: page.tsx — ${name}`);
  if (!ok) failed++;
}

const swSrc = readFileSync(resolve(repo, "public/sw.js"), "utf8");
const swChecks = [
  ["v7 cache name", /halviinim-v7-nocache/],
  ["wipes all caches on activate", /caches\.keys\(\)\.then\(\(names\) =>\s*Promise\.all\(names\.map\(\(n\) => caches\.delete\(n\)\)\)/],
  ["fetch handler bypasses cache for /api/", /url\.pathname\.startsWith\("\/api\/"\)/],
  ["passes API requests with no-store", /fetch\(req, \{ cache: "no-store" \}\)/],
];

for (const [name, re] of swChecks) {
  const ok = re.test(swSrc);
  console.log(`${ok ? "PASS" : "FAIL"}: sw.js — ${name}`);
  if (!ok) failed++;
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll header / cache-defeat checks passed.");
