// End-to-end test against a running next start on http://127.0.0.1:3008
// Exits non-zero if any assertion fails.

const BASE = process.env.BASE || "http://127.0.0.1:3008";
let failed = 0;
function assert(name, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
  if (!cond) failed++;
}

// 1. /api/room
{
  const res = await fetch(`${BASE}/api/room`);
  assert("/api/room status 200", res.status === 200);
  const cc = res.headers.get("cache-control") || "";
  assert(`/api/room cache-control no-store`, /no-store/.test(cc), cc);
  assert(
    `/api/room cdn-cache-control no-store`,
    res.headers.get("cdn-cache-control") === "no-store",
    res.headers.get("cdn-cache-control") || "",
  );
  assert(
    `/api/room cloudflare-cdn-cache-control no-store`,
    res.headers.get("cloudflare-cdn-cache-control") === "no-store",
    res.headers.get("cloudflare-cdn-cache-control") || "",
  );
  assert(
    `/api/room pragma no-cache`,
    res.headers.get("pragma") === "no-cache",
    res.headers.get("pragma") || "",
  );
  const body = await res.json();
  assert("/api/room body has messages", Array.isArray(body.messages));
  assert("/api/room body has daily.limit", typeof body?.daily?.limit === "number");
  assert("/api/room body has presence", body && typeof body.presence === "object");
}

// 2. /api/debug
{
  const res = await fetch(`${BASE}/api/debug`);
  assert("/api/debug status 200", res.status === 200);
  const cc = res.headers.get("cache-control") || "";
  assert(`/api/debug cache-control no-store`, /no-store/.test(cc), cc);
  const body = await res.json();
  assert("/api/debug body ok", body.ok === true);
  assert("/api/debug body has sha", typeof body.sha === "string");
  assert("/api/debug body has kvStatus", typeof body.kvStatus === "string");
  assert("/api/debug body has runtime edge", body.runtime === "edge");
}

// 3. /sw.js
{
  const res = await fetch(`${BASE}/sw.js`);
  assert("/sw.js status 200", res.status === 200);
  const text = await res.text();
  assert("/sw.js is v7", /halviinim-v7-nocache/.test(text));
  assert(
    "/sw.js wipes old caches on activate",
    /caches\.keys\(\)\.then\(/.test(text),
  );
  assert(
    "/sw.js bypasses cache for /api/",
    /url\.pathname\.startsWith\("\/api\/"\)/.test(text),
  );
}

// 4. / page
{
  const res = await fetch(`${BASE}/`);
  assert("/ status 200", res.status === 200);
  const html = await res.text();
  assert("/ page references /sw.js register", /serviceWorker.*register.*sw\.js/s.test(html));
  assert("/ page is RTL Hebrew", /lang="he"/.test(html) && /dir="rtl"/.test(html));
}

// 5. /api/room polled twice — verify idempotency / no caching artifacts
{
  const a = await fetch(`${BASE}/api/room?t=1`);
  const b = await fetch(`${BASE}/api/room?t=2`);
  const aBody = await a.text();
  const bBody = await b.text();
  // Same body (since KV is unavailable, both return same empty state) but
  // headers should always be no-store
  assert(
    "/api/room polled twice — both no-store",
    a.headers.get("cdn-cache-control") === "no-store" &&
      b.headers.get("cdn-cache-control") === "no-store",
  );
  // Bodies should be JSON parseable
  assert("/api/room poll a is json", (() => { try { JSON.parse(aBody); return true; } catch { return false; } })());
  assert("/api/room poll b is json", (() => { try { JSON.parse(bBody); return true; } catch { return false; } })());
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll end-to-end assertions passed.");
