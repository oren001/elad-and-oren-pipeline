import {
  loadMessages,
  readDailyCount,
  readPresence,
  DAILY_LIMIT,
} from "@/lib/room";

export const runtime = "edge";

export async function GET(): Promise<Response> {
  const [messages, used, presence] = await Promise.all([
    loadMessages(),
    readDailyCount(),
    readPresence(),
  ]);
  return new Response(
    JSON.stringify({
      messages,
      daily: { used, limit: DAILY_LIMIT },
      presence,
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
