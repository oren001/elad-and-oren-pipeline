import { loadMessages, readDailyCount, DAILY_LIMIT } from "@/lib/room";

export const runtime = "edge";

export async function GET(): Promise<Response> {
  const messages = await loadMessages();
  const used = await readDailyCount();
  return Response.json({
    messages,
    daily: { used, limit: DAILY_LIMIT },
  });
}
