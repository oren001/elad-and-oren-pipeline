// Spin up next start, hit /api/room, assert headers + JSON shape.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const proc = spawn("npx", ["--no-install", "next", "start", "-p", "3007"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NODE_ENV: "production" },
});

let stderr = "";
let stdout = "";
proc.stderr.on("data", (d) => (stderr += d.toString()));
proc.stdout.on("data", (d) => (stdout += d.toString()));

let failed = 0;
function assert(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) failed++;
}

try {
  // Wait until the server is listening (Next prints "Ready in ...")
  const start = Date.now();
  while (Date.now() - start < 30_000) {
    if (/Ready|started server|Local:/i.test(stdout)) break;
    await sleep(300);
  }

  const res = await fetch("http://127.0.0.1:3007/api/room", {
    cache: "no-store",
  });

  assert("status 200", res.status === 200);
  const cc = res.headers.get("cache-control") || "";
  assert(`cache-control no-store (got: ${cc})`, /no-store/.test(cc));
  const cdn = res.headers.get("cdn-cache-control") || "";
  assert(`cdn-cache-control no-store (got: ${cdn})`, cdn === "no-store");
  const cfCdn = res.headers.get("cloudflare-cdn-cache-control") || "";
  assert(
    `cloudflare-cdn-cache-control no-store (got: ${cfCdn})`,
    cfCdn === "no-store",
  );
  const ct = res.headers.get("content-type") || "";
  assert(`content-type json (got: ${ct})`, /application\/json/.test(ct));

  const body = await res.json();
  assert("body has messages array", Array.isArray(body.messages));
  assert("body has daily.limit", typeof body?.daily?.limit === "number");
  assert("body has presence object", body && typeof body.presence === "object");
} catch (err) {
  console.error("test threw:", err);
  console.error("server stderr tail:", stderr.split("\n").slice(-20).join("\n"));
  console.error("server stdout tail:", stdout.split("\n").slice(-20).join("\n"));
  failed++;
} finally {
  proc.kill("SIGTERM");
  await sleep(200);
}

if (failed > 0) {
  console.error(`\n${failed} runtime check(s) failed`);
  process.exit(1);
}
console.log("\nAll runtime checks passed.");
