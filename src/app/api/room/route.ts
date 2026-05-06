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
  return Response.json({
    messages,
    daily: { used, limit: DAILY_LIMIT },
    presence,
  });
}
