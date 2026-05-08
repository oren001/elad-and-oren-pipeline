import { getKv } from "@/lib/kv";

export const runtime = "edge";

export async function GET(): Promise<Response> {
  const kv = getKv();
  const t0 = Date.now();
  let kvStatus: string;
  let messageCount = -1;
  try {
    if (!kv) {
      kvStatus = "unavailable";
    } else {
      const raw = await kv.get("room:main:msgs");
      if (raw === null) {
        kvStatus = "ok-empty";
        messageCount = 0;
      } else {
        kvStatus = "ok";
        try {
          const parsed = JSON.parse(raw);
          messageCount = Array.isArray(parsed) ? parsed.length : -2;
        } catch {
          messageCount = -3;
        }
      }
    }
  } catch (err) {
    kvStatus = `err:${err instanceof Error ? err.message : "unknown"}`;
  }
  const elapsedMs = Date.now() - t0;

  return new Response(
    JSON.stringify({
      ok: true,
      sha: process.env.NEXT_PUBLIC_BUILD_SHA || "unknown",
      buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || "unknown",
      now: Date.now(),
      kvStatus,
      messageCount,
      kvElapsedMs: elapsedMs,
      runtime: "edge",
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
        "cdn-cache-control": "no-store",
        "cloudflare-cdn-cache-control": "no-store",
        pragma: "no-cache",
      },
    },
  );
}
